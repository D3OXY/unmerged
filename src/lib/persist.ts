import type { Query } from '@tanstack/react-query';
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
 * query runs with nothing in memory (a new page load), the stored result shows as soon as storage answers,
 * while the request goes out as usual and replaces it. One request either way; only the wait disappears.
 */
export async function persisted<T>(queryFn: (context: never) => T | Promise<T>, context: unknown, query: Query): Promise<T> {
  const key = `${prefix(await (account ??= accountItem.getValue()))}${query.queryHash}` as const;
  // The core hands back the context it made for this very `queryFn`. (Its types can't say so for infinite
  // queries, whose page fetcher gets a context without `pageParam`, hence `never` and this one cast.)
  const fresh = Promise.resolve(queryFn(context as never));
  if (query.state.data === undefined) {
    storage.getItem<Entry>(key).then((entry) => {
      // `manual`: show it without ending the fetch that's still running.
      if (entry && Date.now() - entry.at < MAX_AGE && query.state.data === undefined) query.setData(entry.data, { updatedAt: entry.at, manual: true });
    });
  }
  const data = await fresh;
  enqueue(() => store(key, data));
  return data;
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
 * Stores a result unless it's the same as the stored one (same length and hash: polls mostly bring back
 * what they already had, and every write is broadcast to every open tab).
 */
async function store(key: StorageItemKey, data: unknown) {
  const json = JSON.stringify(data);
  const line = { at: Date.now(), bytes: json.length, hash: hashOf(json) };
  const index = await indexItem.getValue();
  const stored = index[key];
  if (stored?.bytes === line.bytes && stored.hash === line.hash) return;
  await writeTrimmed({ ...index, [key]: line }, [{ key, value: { at: line.at, data } satisfies Entry }]);
}

/** Writes `index`, trimmed, along with any new results, then removes the results trimmed out. */
async function writeTrimmed(index: Index, writes: { key: StorageItemKey; value: Entry }[] = []) {
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
  if (dropped.length) await storage.removeItems(dropped);
}

/** FNV-1a: a cheap 32-bit fingerprint of a result's JSON, to tell a changed result from a re-fetched one. */
function hashOf(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}
