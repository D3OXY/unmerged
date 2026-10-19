import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { matchRoute } from '@/lib/routes';
import { runsQuery } from '@/pages/actions/query';
import { branchIndexQuery } from '@/pages/branches/query';
import { prFilesQuery, prMergeQuery, prQuery, prReviewQuery, prTimelineQuery, prViewedQuery } from '@/pages/pr/query';
import { releasesQuery, tagsQuery } from '@/pages/releases/query';
import { codeSearchQuery, repoSearchQuery, workSearchQuery } from '@/pages/search/queries';
import { defaultQuery, repoListQuery, workDetailsQuery, workListQuery, workQueryOf, type ListPage } from '@/pages/work/queries';
import { prefetchRoute } from './prefetch';

/** The list keys `prefetchRoute` starts for `href`, without fetching anything. */
function prefetchedListKeys(href: string) {
  const client = new QueryClient();
  const keys: QueryKey[] = [];
  vi.spyOn(client, 'prefetchQuery').mockResolvedValue();
  vi.spyOn(client, 'prefetchInfiniteQuery').mockImplementation(async (options) => void keys.push(options.queryKey));
  // Pull request lists fetch theirs, to start the details after; an empty list has none.
  vi.spyOn(client, 'fetchInfiniteQuery').mockImplementation(async (options) => (keys.push(options.queryKey), { pages: [], pageParams: [] }));
  const url = new URL(href);
  const route = matchRoute(url);
  if (!route) throw new Error(`no route for ${href}`);
  prefetchRoute(client, route, url);
  return keys;
}

// Each list page passes its bare-URL fallback (and repo) to `WorkList`; prefetch must land on the same key.
describe('prefetchRoute for lists', () => {
  it.each<[string, string, string?]>([
    ['https://github.com/pulls/assigned', defaultQuery('pr', 'assigned')],
    ['https://github.com/issues?q=is:issue+label:bug', defaultQuery('issue', 'created')],
    ['https://github.com/Owner/Repo/pulls', repoListQuery('pulls'), 'Owner/Repo'],
    ['https://github.com/Owner/Repo/issues?q=is:issue+is:closed', repoListQuery('issues'), 'Owner/Repo'],
  ])('starts the page’s list for %s', (href, fallback, repo) => {
    expect(prefetchedListKeys(href)).toEqual([workListQuery(workQueryOf(new URL(href), fallback), repo).queryKey]);
  });
});

// The pull request table's details start once its results are in, as the requests the page makes for them.
describe('prefetchRoute for pull request lists', () => {
  it('starts the details of the results', async () => {
    const client = new QueryClient();
    const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `PR_${i}` }));
    const page = { results: { issueCount: 12, pageInfo: { hasNextPage: false, endCursor: null }, nodes } } as unknown as ListPage;
    vi.spyOn(client, 'fetchInfiniteQuery').mockResolvedValue({ pages: [page], pageParams: [null] });
    const details: QueryKey[] = [];
    const started = new Promise<void>((resolve) =>
      vi.spyOn(client, 'prefetchQuery').mockImplementation(async ({ queryKey }) => {
        if (queryKey[0] === 'work-details' && details.push(queryKey) === 2) resolve();
      }),
    );
    const url = new URL('https://github.com/o/r/pulls');
    prefetchRoute(client, matchRoute(url)!, url);
    await started;
    expect(details).toEqual([
      workDetailsQuery(nodes.slice(0, 10).map((n) => n.id)).queryKey,
      workDetailsQuery(nodes.slice(10).map((n) => n.id)).queryKey,
    ]);
  });
});

// The search page builds its results query from the route; prefetch must land on the same key.
describe('prefetchRoute for search', () => {
  it.each<[string, QueryKey]>([
    ['https://github.com/search?q=hooks&type=repositories&s=stars&o=desc', repoSearchQuery('hooks', 'stars-desc').queryKey],
    ['https://github.com/o/r/search?q=useState', codeSearchQuery('repo:o/r useState').queryKey],
    ['https://github.com/search?q=leak&type=issues&s=bogus', workSearchQuery('leak', 'issues', '').queryKey],
  ])('starts the page’s results for %s', (href, key) => {
    expect(prefetchedListKeys(href)).toEqual([key]);
  });
});

// Every branches tab sorts and filters one index of the repo's branches, so each starts the same query.
describe('prefetchRoute for branches', () => {
  it.each(['https://github.com/O/R/branches', 'https://github.com/o/r/branches/stale?query=fix'])('starts the branch index for %s', (href) => {
    const client = new QueryClient();
    const keys: QueryKey[] = [];
    vi.spyOn(client, 'prefetchQuery').mockImplementation(async (options) => void keys.push(options.queryKey));
    const url = new URL(href);
    prefetchRoute(client, matchRoute(url)!, url);
    expect(keys).toContainEqual(branchIndexQuery('o', 'r').queryKey);
  });
});

// The Actions page builds its runs query from the route and `?query=`; prefetch must land on the same key, and
// skip runs it can't ask for yet (a dynamic workflow's id) or at all (words the API can't filter by).
describe('prefetchRoute for Actions', () => {
  it.each<[string, QueryKey[]]>([
    ['https://github.com/O/R/actions', [runsQuery('o', 'r', undefined, {}).queryKey]],
    ['https://github.com/o/r/actions/workflows/ci.yml?query=is:failure+branch:main', [runsQuery('o', 'r', 'ci.yml', { status: 'failure', branch: 'main' }).queryKey]],
    ['https://github.com/o/r/actions/workflows/pages/pages-build-deployment', []],
    ['https://github.com/o/r/actions?query=flaky', []],
  ])('starts the page’s runs for %s', (href, keys) => {
    expect(prefetchedListKeys(href)).toEqual(keys);
  });
});

// Releases and tags share a page, each tab with its own list.
describe('prefetchRoute for releases', () => {
  it.each<[string, QueryKey]>([
    ['https://github.com/O/R/releases', releasesQuery('o', 'r').queryKey],
    ['https://github.com/o/r/tags', tagsQuery('o', 'r').queryKey],
  ])('starts the page’s list for %s', (href, key) => {
    expect(prefetchedListKeys(href)).toEqual([key]);
  });
});

// A pull request starts all its parts; Files changed also starts the viewed marks, and the patches at the head
// commit that the first part brings.
describe('prefetchRoute for Files changed', () => {
  it('starts the page’s parts, viewed marks and patches', async () => {
    const client = new QueryClient();
    const head = { number: 7, headRefOid: 'abc', changedFiles: 3 };
    const fetched: QueryKey[] = [];
    vi.spyOn(client, 'fetchQuery').mockImplementation(async (options) => {
      fetched.push(options.queryKey);
      return { repository: { pullRequest: head } };
    });
    const keys: QueryKey[] = [];
    const files = new Promise<QueryKey>((resolve) =>
      vi.spyOn(client, 'prefetchQuery').mockImplementation(async (options) => {
        keys.push(options.queryKey);
        if (options.queryKey[0] === 'pr-files') resolve(options.queryKey);
      }),
    );
    const url = new URL('https://github.com/O/R/pull/7/files');
    prefetchRoute(client, matchRoute(url)!, url);
    expect(await files).toEqual(prFilesQuery('O', 'R', head).queryKey);
    expect(fetched).toEqual([prQuery('O', 'R', 7).queryKey]);
    expect(keys).toEqual([
      prMergeQuery('O', 'R', 7).queryKey,
      prReviewQuery('O', 'R', 7).queryKey,
      prTimelineQuery('O', 'R', 7).queryKey,
      prViewedQuery('O', 'R', 7).queryKey,
      prFilesQuery('O', 'R', head).queryKey,
    ]);
  });
});
