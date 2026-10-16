import type { Query } from '@tanstack/react-query';
import { storage } from '#imports';
import { tokenItem } from './settings';

const MAX_AGE = 7 * 86_400_000;
const MAX_ENTRIES = 400;

type Entry = { at: number; data: unknown };

// Keys are per token, so switching accounts never shows the previous one's data.
let namespace: Promise<string> | undefined;
const keyFor = async (hash: string) => {
  namespace ??= tokenItem.getValue().then((token) => token.slice(-8));
  return `local:q:${await namespace}:${hash}` as const;
};
tokenItem.watch(() => (namespace = undefined));

/**
 * A query `persister` (opt in per query) that keeps the last result in extension storage. The next time the
 * query runs with nothing in memory (a new page load), the stored result shows as soon as storage answers,
 * while the request goes out as usual and replaces it. One request either way; only the wait disappears.
 */
export async function persisted<T>(queryFn: (context: never) => T | Promise<T>, context: unknown, query: Query): Promise<T> {
  const key = await keyFor(query.queryHash);
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
  storage.setItem<Entry>(key, { at: Date.now(), data });
  return data;
}

/** Drops expired entries and, past MAX_ENTRIES, the oldest. Run rarely: it reads every stored query. */
export async function trimPersisted() {
  const all = await storage.snapshot('local');
  const entries = Object.entries(all).filter((pair): pair is [string, Entry] => pair[0].startsWith('q:'));
  const now = Date.now();
  const stale = entries.filter(([, entry]) => now - entry.at > MAX_AGE).map(([key]) => key);
  const oldest = entries
    .filter(([, entry]) => now - entry.at <= MAX_AGE)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(MAX_ENTRIES)
    .map(([key]) => key);
  await storage.removeItems([...stale, ...oldest].map((key) => `local:${key}` as const));
}
