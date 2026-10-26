import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { gql, rest } from '@/github/client';
import { earlierItems, joinPr, prFilesQuery, prMergeQuery, prQuery, prReviewQuery, prTimelineQuery, prViewedQuery } from './query';

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

describe('joinPr', () => {
  type Parts = Parameters<typeof joinPr>;
  const rollup = (contexts: object[]) => ({ totalCount: 2, nodes: [{ commit: { statusCheckRollup: { state: 'PENDING', contexts: { nodes: contexts } } } }] });
  const head = {
    repository: { nameWithOwner: 'o/r', isPrivate: false, pullRequest: { id: 'PR', title: 'Fix', commits: rollup([{ __typename: 'CheckRun' }]) } },
  } as unknown as Parts[0];
  const merge = {
    repository: { squashMergeAllowed: true, pullRequest: { mergeable: 'MERGEABLE', commits: rollup([{ __typename: 'CheckRun', name: 'ci' }]) } },
  } as unknown as Parts[1];
  const review = { repository: { pullRequest: { reviewThreads: { totalCount: 0, nodes: [] } } } } as unknown as Parts[2];
  const timeline = { repository: { pullRequest: { timelineItems: { pageInfo: { hasPreviousPage: false }, nodes: [] } } } } as unknown as Parts[3];

  it('waits for the first part, and tells a missing pull request apart', () => {
    expect(joinPr(undefined, merge, review, timeline)).toBeUndefined();
    expect(joinPr({ repository: null }, merge, review, timeline)).toBeNull();
    expect(joinPr({ repository: { nameWithOwner: 'o/r', isPrivate: false, pullRequest: null } }, merge, review, timeline)).toBeNull();
  });

  it('shows the first part alone, then joins each other part to it as it lands', () => {
    expect(joinPr(head, undefined, undefined, undefined)).toMatchObject({ pr: { title: 'Fix' }, merge: undefined, review: undefined, timelineItems: undefined, full: undefined });
    const some = joinPr(head, merge, undefined, timeline);
    expect(some?.merge).toMatchObject({ pr: { title: 'Fix', mergeable: 'MERGEABLE' }, repo: { nameWithOwner: 'o/r', squashMergeAllowed: true } });
    expect(some?.timelineItems).toEqual({ pageInfo: { hasPreviousPage: false }, nodes: [] });
    expect(some?.full).toBeUndefined();
  });

  it('is full once every part is in, with the merge part’s checks in place of the first part’s states', () => {
    const full = joinPr(head, merge, review, timeline)?.full;
    expect(full?.pr).toMatchObject({ id: 'PR', mergeable: 'MERGEABLE', reviewThreads: { totalCount: 0 }, timelineItems: { nodes: [] } });
    expect(full?.pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes).toEqual([{ __typename: 'CheckRun', name: 'ci' }]);
    expect(full?.repo).toEqual({ nameWithOwner: 'o/r', isPrivate: false, squashMergeAllowed: true });
  });
});

describe('earlierItems', () => {
  type Page = Parameters<typeof earlierItems>[1];
  const page = (ids: string[], hasPreviousPage: boolean, hasNextPage: boolean) =>
    ({ pageInfo: { hasPreviousPage, hasNextPage, endCursor: ids.at(-1) ?? null }, nodes: ids.map((id) => ({ id })) }) as unknown as Page;
  const ids = (result: ReturnType<typeof earlierItems>) => result.items.map((item) => item.id);

  it('hides nothing when the newest items are all there is', () => {
    expect(earlierItems([], page(['c', 'd'], false, false))).toEqual({ items: [], more: false });
  });

  it('has more until a page from the start reaches the newest items', () => {
    const newest = page(['e', 'f'], true, false);
    expect(earlierItems([], newest).more).toBe(true);
    const first = earlierItems([page(['a', 'b'], false, true)], newest);
    expect([ids(first), first.more]).toEqual([['a', 'b'], true]);
    // New activity moved the newest items on: the overlap is shown once.
    const last = earlierItems([page(['a', 'b'], false, true), page(['c', 'd', 'e'], true, true)], newest);
    expect([ids(last), last.more]).toEqual([['a', 'b', 'c', 'd'], false]);
  });

  it('has no more after the last item', () => {
    expect(earlierItems([page(['a'], false, false)], page(['b'], true, false)).more).toBe(false);
  });
});

// Mutations and the status poll invalidate the first part's key; that must refetch every part.
describe('pull request parts', () => {
  it('are all invalidated with the first part', async () => {
    const client = new QueryClient();
    const keys = [prQuery('O', 'R', 7).queryKey, prMergeQuery('O', 'R', 7).queryKey, prReviewQuery('O', 'R', 7).queryKey, prTimelineQuery('O', 'R', 7).queryKey];
    for (const key of keys) client.setQueryData(key, { repository: null });
    await client.invalidateQueries({ queryKey: prQuery('o', 'r', 7).queryKey, refetchType: 'none' });
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([true, true, true, true]);
  });
});
