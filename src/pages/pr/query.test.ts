import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { rest } from '@/github/client';
import { prFilesQuery } from './query';

// Each page "returns" its own URL, so the result shows which pages were fetched and in what order.
vi.mock('@/github/client', () => ({ gql: vi.fn(), rest: vi.fn(async (path: string) => [path]) }));

const pageUrl = (page: number) => `/repos/o/r/pulls/7/files?per_page=100&page=${page}`;

describe('prFilesQuery', () => {
  it.each([
    [0, 1],
    [100, 1],
    [101, 2],
    [3000, 30],
    [5000, 30], // GitHub lists no more than 3000
  ])('%i changed files → %i pages, in order', async (changedFiles, pages) => {
    vi.mocked(rest).mockClear();
    const files = await new QueryClient().fetchQuery(prFilesQuery('o', 'r', { number: 7, headRefOid: 'abc', changedFiles }));
    const urls = Array.from({ length: pages }, (_, i) => pageUrl(i + 1));
    expect(vi.mocked(rest)).toHaveBeenCalledTimes(pages);
    expect(files).toEqual(urls);
  });

  it('shows each page once the pages before it are in, while the rest still load', async () => {
    const answers = new Map<string, (files: string[]) => void>();
    vi.mocked(rest).mockImplementation((path) => new Promise((resolve) => answers.set(path, resolve)));
    const client = new QueryClient();
    const query = prFilesQuery('o', 'r', { number: 7, headRefOid: 'abc', changedFiles: 250 });
    // Resolves with the cached files at their next write.
    const nextWrite = () =>
      new Promise<unknown>((resolve) => {
        const stop = client.getQueryCache().subscribe((event) => {
          if (event.type !== 'updated' || event.action.type !== 'success') return;
          stop();
          resolve(event.query.state.data);
        });
      });

    const done = client.fetchQuery(query);
    expect(answers.size).toBe(3); // every page is requested at once

    answers.get(pageUrl(3))!([pageUrl(3)]);
    const first = nextWrite();
    answers.get(pageUrl(1))!([pageUrl(1)]);
    expect(await first).toEqual([pageUrl(1)]); // page 3 waits for page 2
    expect(client.getQueryState(query.queryKey)?.fetchStatus).toBe('fetching');

    answers.get(pageUrl(2))!([pageUrl(2)]);
    expect(await done).toEqual([pageUrl(1), pageUrl(2), pageUrl(3)]);
    expect(client.getQueryState(query.queryKey)?.fetchStatus).toBe('idle');
  });
});
