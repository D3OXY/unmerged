import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { gql, rest } from '@/github/client';
import { prFilesQuery, prViewedQuery } from './query';

// Each page "returns" its own URL, so the result shows which pages were fetched and in what order.
vi.mock('@/github/client', () => ({ gql: vi.fn(), rest: vi.fn(async (path: string) => [path]) }));

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
    const urls = Array.from({ length: pages }, (_, i) => `/repos/o/r/pulls/7/files?per_page=100&page=${i + 1}`);
    expect(vi.mocked(rest)).toHaveBeenCalledTimes(pages);
    expect(files).toEqual(urls);
  });
});

describe('prViewedQuery', () => {
  /** A PR with `count` files where every third one is viewed, served the way GitHub pages `files` by cursor. */
  function fakeGitHub(count: number, cursor = (n: number) => btoa(String(n)).replace(/=+$/, '')) {
    const paths = Array.from({ length: count }, (_, i) => `file${i}`);
    vi.mocked(gql).mockReset().mockImplementation(async (query: string) => {
      const pages = [...query.matchAll(/(p\d+): files\(first: 100(?:, after: "([^"]*)")?\)/g)].map(([, alias, after]) => {
        const start = after ? paths.findIndex((_, i) => cursor(i + 1) === after) + 1 : 0;
        const nodes = paths.slice(start, start + 100).map((path, i) => ({ path, viewerViewedState: (start + i) % 3 ? 'UNVIEWED' : 'VIEWED' }));
        return [alias, { totalCount: count, pageInfo: { hasNextPage: start + 100 < count, endCursor: cursor(start + nodes.length) }, nodes }];
      });
      return { repository: { pullRequest: Object.fromEntries(pages) } };
    });
    return paths;
  }
  const load = () => new QueryClient().fetchQuery(prViewedQuery('o', 'r', 7));
  /** How many `files` pages each request asked for. */
  const requests = () => vi.mocked(gql).mock.calls.map(([query]) => query.match(/files\(/g)?.length);

  it.each([
    [40, [1]],
    [100, [1]],
    [101, [1, 1]],
    [2417, [1, 24]],
  ])('%i files → requests for %j pages', async (count, pages) => {
    const paths = fakeGitHub(count);
    const viewed = await load();
    expect(requests()).toEqual(pages);
    expect(Object.keys(viewed)).toEqual(paths);
    expect(viewed.file3).toBe('VIEWED');
    expect(viewed.file4).toBe('UNVIEWED');
  });

  it('follows the cursors one page at a time when they are not counts', async () => {
    const paths = fakeGitHub(250, (n) => `opaque-${n}`);
    expect(Object.keys(await load())).toEqual(paths);
    expect(requests()).toEqual([1, 1, 1]);
  });
});
