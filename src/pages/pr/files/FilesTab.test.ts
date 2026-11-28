import { act, createElement, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { rest } from '@/github/client';
import { viewerKey } from '@/lib/persist';
import { commitFilesQuery } from '@/pages/commit/query';
import { prFilesQuery, prViewedQuery, type PullRequest } from '../query';
import type { FileDiff, PrFile } from './FileDiff';
import { FilesTab } from './FilesTab';

vi.mock('@/github/client', () => ({ gql: vi.fn(), rest: vi.fn() }));
vi.mock('@/lib/diffs', () => ({ loadDiffs: async () => ({ preloadHighlighting() {} }) }));
// Read the file card's inputs for expanding context and posting a line comment.
vi.mock('./FileDiff', async (original) => ({
  ...await original<typeof import('./FileDiff')>(),
  FileDiff: ({ file, source, review }: ComponentProps<typeof FileDiff>) => createElement('output', {
    'data-context': source.oid, 'data-comment': review?.pr?.headRefOid,
  }, file.filename),
}));

it('keeps the displayed commit, file limit, and review target together while another range loads', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const pr = { id: 'PR', number: 7, url: 'https://github.com/o/r/pull/7', headRefOid: 'bbbbbbb', commits: { totalCount: 2 }, reviewThreads: { nodes: [] } } as unknown as PullRequest;
  const first = 'aaaaaaa';
  const second = `${first}..${pr.headRefOid}`;
  const files = Array.from({ length: 350 }, (_, i): PrFile => ({
    filename: `old/${i}`, sha: first, changes: 1, additions: 1, deletions: 0, status: 'modified', blob_url: '',
  }));
  client.setQueryData(viewerKey, null);
  client.setQueryData(prViewedQuery('o', 'r', 7).queryKey, {});
  client.setQueryData(commitFilesQuery('o', 'r', first).queryKey, files);
  await client.fetchQuery(prFilesQuery('o', 'r', first));

  const next = Promise.withResolvers<{ files: PrFile[] }>();
  vi.mocked(rest).mockReturnValue(next.promise);
  const host = document.createElement('div');
  const root = createRoot(host);
  const show = (range: string) => act(() => root.render(createElement(QueryClientProvider, { client },
    createElement(FilesTab, { pr, full: pr, queryKey: [], range }),
  )));
  try {
    await show(first);
    await show(second);
    const old = host.querySelector('output');
    expect(old?.textContent).toBe('old/0');
    expect(old?.dataset.context).toBe(first);
    expect(old?.dataset.comment).toBeUndefined();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Loading changes…');
    expect(host.textContent).toContain('350 files');
    expect(host.textContent).not.toContain('only the first 300');
    expect(rest).toHaveBeenCalledWith('/repos/o/r/compare/aaaaaaa...bbbbbbb?per_page=1');

    next.resolve({ files: files.slice(0, 300).map((file, i) => ({ ...file, filename: `new/${i}` })) });
    await client.fetchQuery(prFilesQuery('o', 'r', second));
    await show(second);
    const current = host.querySelector('output');
    expect(current?.textContent).toBe('new/0');
    expect(current?.dataset.context).toBe(pr.headRefOid);
    expect(current?.dataset.comment).toBe(pr.headRefOid);
    expect(host.textContent).toContain('only the first 300 changed files');
  } finally {
    await act(() => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});
