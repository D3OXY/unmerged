import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { matchRoute } from '@/lib/routes';
import { issueSplitItem, nestIssuesItem } from '@/lib/settings';
import { runsQuery } from '@/pages/actions/query';
import { branchIndexQuery } from '@/pages/branches/query';
import { issueQuery, issueTimelineQuery } from '@/pages/issue/query';
import { prFilesQuery, prMergeQuery, prQuery, prReviewQuery, prTimelineQuery, prViewedQuery } from '@/pages/pr/query';
import { releasesQuery, tagsQuery } from '@/pages/releases/query';
import { codeSearchQuery, repoSearchQuery, workSearchQuery } from '@/pages/search/queries';
import { defaultQuery, issueFamilyQuery, prefetchWorkList, repoListQuery, workDetailsQuery, workListQuery, workQueryOf, type ListPage } from '@/pages/work/queries';
import { prefetchRoute, prefetchVisibleRows, rowsToPrefetch } from './prefetch';

/** The list keys `prefetchRoute` starts for `href`, without fetching anything. */
function prefetchedListKeys(href: string) {
  const client = new QueryClient();
  const keys: QueryKey[] = [];
  vi.spyOn(client, 'prefetchQuery').mockResolvedValue();
  vi.spyOn(client, 'prefetchInfiniteQuery').mockImplementation(async (options) => void keys.push(options.queryKey));
  // Pull request and issue lists fetch theirs, to start the details after; an empty list has none.
  vi.spyOn(client, 'fetchInfiniteQuery').mockImplementation(async (options) => (keys.push(options.queryKey), { pages: [], pageParams: [] }));
  const url = new URL(href);
  const route = matchRoute(url);
  if (!route) throw new Error(`no route for ${href}`);
  prefetchRoute(client, route, url);
  return keys;
}

/** The pull request or issue list `prefetchRoute` starts for `href`, once it starts: an issue list reads its settings first. */
function prefetchedWorkList(href: string) {
  const client = new QueryClient();
  vi.spyOn(client, 'prefetchQuery').mockResolvedValue();
  const started = new Promise<QueryKey>((resolve) => {
    vi.spyOn(client, 'fetchInfiniteQuery').mockImplementation(async (options) => (resolve(options.queryKey), { pages: [], pageParams: [] }));
  });
  const url = new URL(href);
  const route = matchRoute(url);
  if (!route) throw new Error(`no route for ${href}`);
  prefetchRoute(client, route, url);
  return started;
}

// Each list page passes its bare-URL fallback (and repo) to `WorkList`; prefetch must land on the same key.
describe('prefetchRoute for lists', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each<[string, string, string?]>([
    ['https://github.com/pulls/assigned', defaultQuery('pr', 'assigned')],
    ['https://github.com/issues?q=is:issue+label:bug', defaultQuery('issue', 'created')],
    ['https://github.com/Owner/Repo/pulls', repoListQuery('pulls'), 'Owner/Repo'],
    ['https://github.com/Owner/Repo/issues?q=is:issue+is:closed', repoListQuery('issues'), 'Owner/Repo'],
  ])('starts the page’s list for %s', async (href, fallback, repo) => {
    expect(await prefetchedWorkList(href)).toEqual(workListQuery(workQueryOf(new URL(href), fallback), repo).queryKey);
  });

  it('starts the nested list when Nest sub-issues is on', async () => {
    await nestIssuesItem.setValue(true);
    expect(await prefetchedWorkList('https://github.com/o/r/issues')).toEqual(workListQuery(repoListQuery('issues'), 'o/r', true).queryKey);
  });
});

// The table's details start once its results are in, as the requests the page makes for them.
describe('prefetchRoute for list tables', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `ID_${i}` }));

  /** A client whose list fetch returns `nodes`, the details keys it prefetches, and a promise for when both chunks start. */
  function listClient() {
    const client = new QueryClient();
    const page = { results: { issueCount: 12, pageInfo: { hasNextPage: false, endCursor: null }, nodes } } as unknown as ListPage;
    vi.spyOn(client, 'fetchInfiniteQuery').mockResolvedValue({ pages: [page], pageParams: [null] });
    const details: QueryKey[] = [];
    const started = new Promise<void>((resolve) =>
      vi.spyOn(client, 'prefetchQuery').mockImplementation(async ({ queryKey }) => {
        if (queryKey[0] === 'work-details' && details.push(queryKey) === 2) resolve();
      }),
    );
    return { client, details, started };
  }

  beforeEach(() => fakeBrowser.reset());

  it.each(['https://github.com/o/r/pulls', 'https://github.com/o/r/issues'])('starts the details of the results for %s', async (href) => {
    const { client, details, started } = listClient();
    const url = new URL(href);
    prefetchRoute(client, matchRoute(url)!, url);
    await started;
    expect(details).toEqual([
      workDetailsQuery(nodes.slice(0, 10).map((n) => n.id)).queryKey,
      workDetailsQuery(nodes.slice(10).map((n) => n.id)).queryKey,
    ]);
  });

  it('starts the families and no details for a nested issue list', async () => {
    await nestIssuesItem.setValue(true);
    const client = new QueryClient();
    const nodes = [
      { __typename: 'Issue', id: 'A', parent: { id: 'P' }, subIssues: { totalCount: 0 } },
      { __typename: 'Issue', id: 'B', parent: null, subIssues: { totalCount: 2 } },
      { __typename: 'Issue', id: 'C', parent: null, subIssues: { totalCount: 0 } },
    ];
    const page = { results: { issueCount: 3, pageInfo: { hasNextPage: false, endCursor: null }, nodes } } as unknown as ListPage;
    vi.spyOn(client, 'fetchInfiniteQuery').mockResolvedValue({ pages: [page], pageParams: [null] });
    const keys: QueryKey[] = [];
    vi.spyOn(client, 'prefetchQuery').mockImplementation(async ({ queryKey }) => void keys.push(queryKey));
    await prefetchWorkList(client, 'issue', repoListQuery('issues'), 'o/r');
    expect(keys.filter((key) => key[0] !== 'work-count')).toEqual([issueFamilyQuery('P').queryKey, issueFamilyQuery('B').queryKey]);
  });

  it('starts no details for a split issue list', async () => {
    await issueSplitItem.setValue(true);
    const { client, details } = listClient();
    await prefetchWorkList(client, 'issue', repoListQuery('issues'), 'o/r');
    expect(details).toEqual([]);
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

// The issue page reads the issue and its timeline from two queries; prefetch must start both, on the same keys.
describe('prefetchRoute for an issue', () => {
  it('starts the page’s issue and timeline', () => {
    const client = new QueryClient();
    const keys: QueryKey[] = [];
    vi.spyOn(client, 'prefetchQuery').mockImplementation(async (options) => void keys.push(options.queryKey));
    const url = new URL('https://github.com/O/R/issues/7');
    prefetchRoute(client, matchRoute(url)!, url);
    expect(keys).toEqual(expect.arrayContaining([issueQuery('O', 'R', 7).queryKey, issueTimelineQuery('O', 'R', 7).queryKey]));
  });
});

const rowsOf = (...hrefs: string[]) => hrefs.map((href) => ({ href }));
const prRows = (from: number, to: number) => rowsOf(...Array.from({ length: to - from + 1 }, (_, i) => `https://github.com/o/r/pull/${from + i}`));
const picked = (client: QueryClient, rows: { href: string }[]) => rowsToPrefetch(client, rows).map(({ query }) => query.queryKey);

// A row's prefetch is the first query its page asks for, so opening it finds that query in the cache.
describe('rowsToPrefetch', () => {
  it.each(['https://github.com/O/R/pull/7', 'https://github.com/o/r/issues/7'])('picks a query that prefetchRoute starts for %s', (href) => {
    const client = new QueryClient();
    const keys: QueryKey[] = [];
    const record = async (options: { queryKey: QueryKey }) => void keys.push(options.queryKey);
    vi.spyOn(client, 'prefetchQuery').mockImplementation(record);
    vi.spyOn(client, 'fetchQuery').mockImplementation(async (options) => (record(options), { repository: null }));
    const url = new URL(href);
    prefetchRoute(client, matchRoute(url)!, url);
    const [key] = picked(client, rowsOf(href));
    expect(keys).toContainEqual(key);
  });

  it('picks pull requests and issues once each, at most 10', () => {
    const rows = rowsOf(
      'https://github.com/o/r',
      'https://example.com/o/r/pull/1',
      'https://github.com/o/r/pull/1',
      'https://github.com/o/r/pull/1/files',
      'https://github.com/o/r/issues/2',
    );
    expect(picked(new QueryClient(), [...rows, ...prRows(3, 20)])).toEqual([
      prQuery('o', 'r', 1).queryKey,
      issueQuery('o', 'r', 2).queryKey,
      ...[3, 4, 5, 6, 7, 8, 9, 10].map((n) => prQuery('o', 'r', n).queryKey),
    ]);
  });

  it('skips what was fetched in the last minutes or is under way, not older results', () => {
    const client = new QueryClient();
    client.setQueryData(prQuery('o', 'r', 1).queryKey, { repository: null });
    client.setQueryData(prQuery('o', 'r', 2).queryKey, { repository: null }, { updatedAt: Date.now() - 10 * 60_000 });
    client.prefetchQuery({ queryKey: prQuery('o', 'r', 3).queryKey, queryFn: () => new Promise<never>(() => {}) });
    expect(picked(client, prRows(1, 4))).toEqual([prQuery('o', 'r', 2).queryKey, prQuery('o', 'r', 4).queryKey]);
  });
});

describe('prefetchVisibleRows', () => {
  let report: (entries: { target: Element; isIntersecting: boolean }[]) => void;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => setTimeout(callback));
    vi.stubGlobal('cancelIdleCallback', (id: number) => clearTimeout(id));
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(any-hover: hover)' }));
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'connection');
  });

  /** A list of pull request rows; `show` reports which are on screen, as a scroll would. Prefetches stay open until `finish`. */
  function list(count: number) {
    const element = document.createElement('div');
    element.innerHTML = prRows(1, count).map(({ href }) => `<a data-row href="${href}"></a>`).join('');
    const rows = [...element.children];
    const client = new QueryClient();
    const started: number[] = [];
    const pending: (() => void)[] = [];
    vi.spyOn(client, 'prefetchQuery').mockImplementation(({ queryKey }) => {
      started.push(queryKey.at(-1) as number);
      return new Promise((done) => pending.push(done));
    });
    const stop = prefetchVisibleRows(client, element);
    return {
      started,
      stop,
      show: (from: number, to: number) => report(rows.map((target, i) => ({ target, isIntersecting: i + 1 >= from && i + 1 <= to }))),
      /** Ends the prefetches under way and lets the next ones start. */
      finish: async () => {
        pending.splice(0).forEach((done) => done());
        await vi.advanceTimersByTimeAsync(0);
      },
    };
  }

  it('starts once the rows on screen settle, two at a time, up to 10', async () => {
    const { started, show, finish } = list(30);
    show(1, 20);
    await vi.advanceTimersByTimeAsync(399);
    expect(started).toEqual([]);
    // The settle, then the idle callback.
    await vi.advanceTimersByTimeAsync(10);
    expect(started).toEqual([1, 2]);
    for (let i = 0; i < 6; i++) await finish();
    expect(started).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('waits while the rows move, and drops rows that leave the screen', async () => {
    const { started, show, finish } = list(30);
    show(1, 20);
    await vi.advanceTimersByTimeAsync(300);
    show(11, 30);
    await vi.advanceTimersByTimeAsync(300);
    expect(started).toEqual([]);
    await vi.advanceTimersByTimeAsync(110);
    expect(started).toEqual([11, 12]);
    show(0, 0);
    await finish();
    expect(started).toEqual([11, 12]);
  });

  it('stops when the list goes away', async () => {
    const { started, show, stop } = list(5);
    show(1, 5);
    stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(started).toEqual([]);
  });

  it.each([
    ['a touch-only device', () => vi.stubGlobal('matchMedia', () => ({ matches: false }))],
    ['Save-Data', () => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })],
    ['a slow connection', () => Object.defineProperty(navigator, 'connection', { value: { effectiveType: '3g' }, configurable: true })],
  ])('does nothing on %s', async (_, set) => {
    set();
    const { started, show } = list(5);
    show(1, 5);
    await vi.advanceTimersByTimeAsync(1000);
    expect(started).toEqual([]);
  });
});
