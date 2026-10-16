import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { rest } from '@/github/client';
import { prFilesQuery } from './query';

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
