import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { rest } from '@/github/client';
import type { PrFile } from '@/pages/pr/files/FileDiff';
import { commitFilesQuery } from './query';

vi.mock('@/github/client', () => ({ gql: vi.fn(), rest: vi.fn() }));

describe('commitFilesQuery', () => {
  it('pages through the files until a page comes back short', async () => {
    const pages = [100, 3];
    vi.mocked(rest).mockImplementation(async () => ({ files: Array.from({ length: pages.shift() ?? 0 }, () => ({}) as PrFile) }));
    const files = await new QueryClient().fetchQuery(commitFilesQuery('o', 'r', 'abc1234'));
    expect(files).toHaveLength(103);
    expect(vi.mocked(rest).mock.calls.map(([path]) => path)).toEqual([
      '/repos/o/r/commits/abc1234?per_page=100&page=1',
      '/repos/o/r/commits/abc1234?per_page=100&page=2',
    ]);
  });
});
