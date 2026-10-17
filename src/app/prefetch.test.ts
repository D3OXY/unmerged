import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { matchRoute } from '@/lib/routes';
import { codeSearchQuery, repoSearchQuery, workSearchQuery } from '@/pages/search/queries';
import { defaultQuery, repoListQuery, workListQuery, workQueryOf } from '@/pages/work/queries';
import { prefetchRoute } from './prefetch';

/** The list keys `prefetchRoute` starts for `href`, without fetching anything. */
function prefetchedListKeys(href: string) {
  const client = new QueryClient();
  const keys: QueryKey[] = [];
  vi.spyOn(client, 'prefetchQuery').mockResolvedValue();
  vi.spyOn(client, 'prefetchInfiniteQuery').mockImplementation(async (options) => void keys.push(options.queryKey));
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
