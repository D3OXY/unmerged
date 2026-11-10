import { hashKey, type Query, type QueryCache, type QueryKey, type StaleTimeFunction } from '@tanstack/react-query';
import { storage, type StorageItemKey } from '#imports';
import { clearDrafts } from './drafts';
import { accountItem, tokenItem } from './settings';

/** Stored results older than this aren't shown, and the next trim drops them. */
const MAX_AGE = 7 * 86_400_000;
/** Size the stored results are trimmed back to, oldest first (serialized JSON length, close to bytes). */
const MAX_BYTES = 50 * 2 ** 20;

type Entry = { at: number; data: unknown };
/** What the index knows about a stored result: when it last changed, its size, and a hash of its JSON. */
type Line = { at: number; bytes: number; hash: number };
type Index = Record<StorageItemKey, Line>;

/** One line per stored result, so change checks and trims never load the results themselves. */
const indexItem = storage.defineItem<Index>('local:query-index', { fallback: {} });

// Keys are per account, so switching accounts never shows the previous one's data.
const prefix = (account: string) => `local:query:${account}:` as const;
let account: Promise<string> | undefined;
accountItem.watch(() => (account = undefined));

// The index is read, changed and written back, so this context runs its updates one at a time. (Two tabs
// can still race; a lost line only leaves that result unindexed until its query is stored again.)
let queue = Promise.resolve();
const enqueue = (task: () => Promise<void>) => (queue = queue.then(task).catch(() => {}));

/**
 * A query `persister` (opt in per query) that keeps the last result in extension storage. The next time the
 * query runs with nothing in memory (a new page load), the stored result shows as soon as storage answers. If
 * GitHub confirmed it within the query's `staleTime`, no request goes out; else the request replaces it.
 */
export async function persisted<T>(queryFn: (context: never) => T | Promise<T>, context: unknown, query: Query): Promise<T> {
  const key = `${prefix(await (account ??= accountItem.getValue()))}${query.queryHash}` as const;
  const [stored] = query.state.data === undefined ? await read([key]) : [];
  if (stored && query.state.data === undefined) {
    // Read first: `setData` clears it.
    const { isInvalidated } = query.state;
    // `manual`: show it without ending the fetch. Dated when GitHub last confirmed it, so the query's own
    // `staleTime` (also a function of the data) tells if it still holds.
    query.setData(stored.data, { updatedAt: stored.checked, manual: true });
    if (!isInvalidated && !query.isStaleByTime(staleTimeOf(query))) {
      // The core dates what this returns now; put back the stored date once it has (as TanStack's own persister does).
      setTimeout(() => query.setState({ dataUpdatedAt: stored.checked }));
      return stored.data as T;
    }
  }
  // The core hands back the context it made for this very `queryFn`. (Its types can't say so for infinite
  // queries, whose page fetcher gets a context without `pageParam`, hence `never` and this one cast.)
  const data = await queryFn(context as never);
  enqueue(() => store(key, data));
  return data;
}

/**
 * Makes a persisted query's stored result stale when this tab changes the query's data without a fetch: an
 * optimistic edit (`setQueryData`) or an invalidation. Else a new tab could show the result from before the change,
 * without a request, until its `staleTime` ends. Writes dated with `updatedAt` came from GitHub and are left out.
 */
export function watchLocalEdits(cache: QueryCache) {
  return cache.subscribe((event) => {
    if (event.type !== 'updated' || event.query.options.persister !== persisted) return;
    const { action } = event;
    if (action.type === 'invalidate' || (action.type === 'success' && action.manual && action.dataUpdatedAt === undefined)) {
      const { queryHash } = event.query;
      enqueue(async () => storage.removeItem(checkedKey(`${prefix(await accountItem.getValue())}${queryHash}`)));
    }
  });
}

// The sidebar's queries. It shows on every owned page, so the content script reads their stored results with the
// account (see `readPersisted`) and the app puts them in the query client before its first render.
export const viewerKey = ['viewer'] as const;
export const recentReposKey = ['recent-repos'] as const;

/** A stored result, with the query it belongs to and when GitHub last confirmed it. */
export type Seed = { queryKey: QueryKey; data: unknown; checked: number };

/**
 * Reads `account`'s stored results for `queryKeys`. Results older than MAX_AGE are left out, as `persisted`
 * leaves them out.
 */
export async function readPersisted(account: string, queryKeys: QueryKey[]): Promise<Seed[]> {
  const stored = await read(queryKeys.map((queryKey) => `${prefix(account)}${hashKey(queryKey)}` as const));
  return stored.flatMap((value, i) => (value ? [{ queryKey: queryKeys[i]!, ...value }] : []));
}

/** Drops other accounts' results, expired ones, and the oldest past MAX_BYTES. Reads only the index. */
export function trimPersisted() {
  return enqueue(async () => writeTrimmed(await indexItem.getValue()));
}

/**
 * Saves the token ('' disconnects) under a new account id, and drops every other account's stored results and
 * comment drafts.
 */
export async function saveToken(token: string) {
  await storage.setItems([
    { item: tokenItem, value: token },
    { item: accountItem, value: crypto.randomUUID().slice(0, 8) },
  ]);
  await trimPersisted();
  // After the trim, so listing the keys doesn't load the old account's results.
  await clearDrafts();
}

/**
 * When GitHub last confirmed a stored result: written on every fetch, also when the result didn't change (a small
 * write, unlike the result). A result without one counts as stale.
 */
const checkedKey = (key: StorageItemKey) => `${key}:checked` as const;

/**
 * Reads stored results in one storage call: each with when GitHub last confirmed it (0 if never), or undefined if
 * there's none or it's older than MAX_AGE.
 */
async function read(keys: StorageItemKey[]) {
  const values = await storage.getItems(keys.flatMap((key) => [key, checkedKey(key)]));
  return keys.map((_, i) => {
    const entry: Entry | null = values[2 * i]!.value;
    const checked: number | null = values[2 * i + 1]!.value;
    return entry && Date.now() - entry.at < MAX_AGE ? { data: entry.data, checked: checked ?? 0 } : undefined;
  });
}

// `Query.options` has the observer's or fetch's options, `staleTime` included, but its type leaves `staleTime` out.
function staleTimeOf(query: Query) {
  const { staleTime } = query.options as { staleTime?: StaleTimeFunction };
  return typeof staleTime === 'function' ? staleTime(query) : staleTime;
}

/**
 * Stores a fetched result unless it's the same as the stored one (same length and hash: polls mostly bring back
 * what they already had, and every write is broadcast to every open tab). Either way, dates the check.
 */
async function store(key: StorageItemKey, data: unknown) {
  const json = JSON.stringify(data);
  const line = { at: Date.now(), bytes: json.length, hash: hashOf(json) };
  const checked = { key: checkedKey(key), value: line.at };
  const index = await indexItem.getValue();
  const stored = index[key];
  if (stored?.bytes === line.bytes && stored.hash === line.hash) return storage.setItem(checked.key, checked.value);
  await writeTrimmed({ ...index, [key]: line }, [{ key, value: { at: line.at, data } satisfies Entry }, checked]);
}

/** Writes `index`, trimmed, along with `writes`, then removes the results trimmed out. */
async function writeTrimmed(index: Index, writes: { key: StorageItemKey; value: unknown }[] = []) {
  const current = prefix(await accountItem.getValue());
  const now = Date.now();
  const kept: Index = {};
  const dropped: StorageItemKey[] = [];
  let bytes = 0;
  const newestFirst = (Object.entries(index) as [StorageItemKey, Line][]).sort(([, a], [, b]) => b.at - a.at);
  for (const [key, line] of newestFirst) {
    if (key.startsWith(current) && now - line.at <= MAX_AGE && (bytes += line.bytes) <= MAX_BYTES) kept[key] = line;
    else dropped.push(key);
  }
  await storage.setItems([...writes, { item: indexItem, value: kept }]);
  if (dropped.length) await storage.removeItems(dropped.flatMap((key) => [key, checkedKey(key)]));
}

/** FNV-1a: a cheap 32-bit fingerprint of a result's JSON, to tell a changed result from a re-fetched one. */
function hashOf(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}
