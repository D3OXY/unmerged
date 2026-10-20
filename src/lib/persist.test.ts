import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage, type StorageItemKey } from '#imports';
import { persisted, readPersisted, saveToken, trimPersisted } from './persist';
import { accountItem, tokenItem } from './settings';

const NOW = new Date('2026-06-01').getTime();
const DAY = 86_400_000;
const MB = 2 ** 20;

const index = () => storage.getItem<Record<StorageItemKey, { at: number; bytes: number; hash: number }>>('local:query-index', { fallback: {} });

/** Stores results and their index lines directly: `[key, at, bytes]`. */
async function seed(entries: [StorageItemKey, number, number][]) {
  await storage.setItem('local:query-index', Object.fromEntries(entries.map(([key, at, bytes]) => [key, { at, bytes, hash: 0 }])));
  await storage.setItems(entries.map(([key, at]) => ({ key, value: { at, data: key } })));
}

beforeEach(async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await accountItem.setValue('a');
});

describe('trimPersisted', () => {
  it("keeps the current account's results from the last 7 days, newest first, within 50 MB", async () => {
    await seed([
      ['local:query:a:new', NOW, 20 * MB],
      ['local:query:b:other-account', NOW, 1],
      ['local:query:a:day-old', NOW - DAY, 20 * MB],
      ['local:query:a:over-budget', NOW - 2 * DAY, 20 * MB],
      ['local:query:a:expired', NOW - 8 * DAY, 1],
    ]);
    await trimPersisted();
    expect(Object.keys(await index())).toEqual(['local:query:a:new', 'local:query:a:day-old']);
    for (const key of ['local:query:b:other-account', 'local:query:a:over-budget', 'local:query:a:expired'] as const) {
      expect(await storage.getItem(key)).toBeNull();
    }
    expect(await storage.getItem('local:query:a:new')).not.toBeNull();
  });
});

describe('persisted', () => {
  const KEY = 'local:query:a:["repo"]';
  const client = new QueryClient();
  // `trimPersisted` queues behind the store, so awaiting it waits for the write.
  const fetchRepo = async (data: unknown) => {
    await client.fetchQuery({ queryKey: ['repo'], queryFn: () => data, persister: persisted, staleTime: 0 });
    await trimPersisted();
  };

  it('stores a result only when it changed', async () => {
    await fetchRepo({ stars: 1 });
    vi.setSystemTime(NOW + 60_000);
    await fetchRepo({ stars: 1 });
    expect(await storage.getItem(KEY)).toEqual({ at: NOW, data: { stars: 1 } });
    expect((await index())[KEY]?.at).toBe(NOW);

    await fetchRepo({ stars: 2 });
    expect(await storage.getItem(KEY)).toEqual({ at: NOW + 60_000, data: { stars: 2 } });
  });
});

describe('readPersisted', () => {
  it("reads the account's stored results for the given queries, except expired ones", async () => {
    await new QueryClient().fetchQuery({ queryKey: ['viewer'], queryFn: () => 'octocat', persister: persisted });
    await trimPersisted();
    await storage.setItem('local:query:a:["expired"]', { at: NOW - 8 * DAY, data: 'old' });

    expect(await readPersisted('a', [['viewer'], ['expired'], ['missing']])).toEqual([{ queryKey: ['viewer'], at: NOW, data: 'octocat' }]);
    expect(await readPersisted('b', [['viewer']])).toEqual([]);
  });
});

describe('saveToken', () => {
  it("drops the previous account's results and comment drafts", async () => {
    await seed([['local:query:a:viewer', NOW, 1]]);
    await storage.setItem('local:draft:owner/repo#1', 'private text');
    await saveToken('ghp_next');

    expect(await tokenItem.getValue()).toBe('ghp_next');
    expect(await accountItem.getValue()).not.toBe('a');
    expect(await index()).toEqual({});
    expect(await storage.getItem('local:query:a:viewer')).toBeNull();
    expect(await storage.getItem('local:draft:owner/repo#1')).toBeNull();
  });
});
