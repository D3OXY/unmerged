import { hashKey, QueryClient, type FetchQueryOptions, type QueryKey } from '@tanstack/react-query';
import { achievementsQuery } from '@/github/achievements';
import { prefetchActions, prefetchRun } from '@/pages/actions/query';
import { prefetchBranches } from '@/pages/branches/query';
import { matchRoute, type Route } from '@/lib/routes';
import { prefetchCommit } from '@/pages/commit/query';
import { prefetchCompare } from '@/pages/compare/query';
import { contributorsQuery } from '@/pages/contributors/query';
import { prefetchHome } from '@/pages/home/queries';
import { newIssueQuery } from '@/pages/issue/newIssue';
import { issueQuery, issueTimelineQuery } from '@/pages/issue/query';
import { notificationsQuery, viewOf } from '@/pages/notifications/queries';
import { orgPeopleQuery, orgQuery, orgReadmeQuery, orgWorkQuery } from '@/pages/org/queries';
import { prefetchPr, prQuery } from '@/pages/pr/query';
import { prefetchReleases } from '@/pages/releases/query';
import {
  followsQuery,
  profileActivityQuery,
  profileHeadQuery,
  profileReadmeQuery,
  profileReposQuery,
  profileUserQuery,
  profileWorkQuery,
} from '@/pages/profile/queries';
import { prefetchRepo, repoQuery } from '@/pages/repo/query';
import { prefetchSearch } from '@/pages/search/queries';
import { defaultQuery, prefetchWorkList, repoListQuery, workQueryOf, workTabCountQueries } from '@/pages/work/queries';

/**
 * Starts the requests a page makes when it opens, so they're under way (or done) by the time it renders:
 * at page load, before React and our styles are ready, and when a link to the page is hovered or pressed.
 * These are the pages' own query options, so nothing is fetched twice and fresh data isn't refetched.
 */
export function prefetchRoute(client: QueryClient, route: Route, url: URL) {
  // A list's side panel loads with it.
  if ((route.kind === 'work' || route.kind === 'repo') && route.peek) prefetchRoute(client, route.peek, url);
  switch (route.kind) {
    case 'home':
      prefetchHome(client);
      return;
    case 'profile': {
      const { login, tab } = route;
      client.prefetchQuery(achievementsQuery(login));
      if (tab === 'overview') {
        // A login is only known to be an organization once `user` comes back null; its page's requests start then.
        const user = profileUserQuery(login);
        client.prefetchQuery(user).then(() => {
          if (client.getQueryData(user.queryKey) !== null) return;
          client.prefetchQuery(orgQuery(login));
          client.prefetchQuery(orgWorkQuery(login));
          client.prefetchQuery(orgReadmeQuery(login));
        });
        client.prefetchQuery(profileWorkQuery(login));
        client.prefetchQuery(profileActivityQuery(login));
        client.prefetchQuery(profileReadmeQuery(login));
        return;
      }
      client.prefetchQuery(profileHeadQuery(login));
      if (tab === 'repositories') client.prefetchInfiniteQuery(profileReposQuery(login));
      if (tab === 'followers' || tab === 'following') client.prefetchInfiniteQuery(followsQuery(login, tab));
      return;
    }
    case 'org':
      client.prefetchQuery(orgQuery(route.login));
      if (route.tab === 'repositories') client.prefetchInfiniteQuery(profileReposQuery(route.login));
      else client.prefetchInfiniteQuery(orgPeopleQuery(route.login));
      return;
    case 'repo':
      if (route.view === 'issues' || route.view === 'pulls') {
        client.prefetchQuery(repoQuery(route.owner, route.repo));
        prefetchWorkList(client, route.view === 'pulls' ? 'pr' : 'issue', workQueryOf(url, repoListQuery(route.view)), `${route.owner}/${route.repo}`);
      } else prefetchRepo(client, route.owner, route.repo, route.view, route.rest);
      return;
    case 'issue':
      client.prefetchQuery(repoQuery(route.owner, route.repo));
      client.prefetchQuery(issueQuery(route.owner, route.repo, route.number));
      client.prefetchQuery(issueTimelineQuery(route.owner, route.repo, route.number));
      return;
    case 'newIssue':
      client.prefetchQuery(repoQuery(route.owner, route.repo));
      client.prefetchQuery(newIssueQuery(route.owner, route.repo));
      return;
    case 'pr':
      prefetchPr(client, route.owner, route.repo, route.number, route.tab);
      return;
    case 'commit':
      prefetchCommit(client, route.owner, route.repo, route.sha, route.pr);
      return;
    case 'actions':
      client.prefetchQuery(repoQuery(route.owner, route.repo));
      prefetchActions(client, route.owner, route.repo, route.workflow, url);
      return;
    case 'run':
      prefetchRun(client, route.owner, route.repo, route.runId, route.attempt, route.job);
      return;
    case 'branches':
      prefetchBranches(client, route.owner, route.repo);
      return;
    case 'contributors':
      client.prefetchQuery(repoQuery(route.owner, route.repo));
      client.prefetchQuery(contributorsQuery(route.owner, route.repo));
      return;
    case 'releases':
    case 'release':
      prefetchReleases(client, route);
      return;
    case 'compare':
      prefetchCompare(client, route);
      return;
    case 'work':
      prefetchWorkList(client, route.type, workQueryOf(url, defaultQuery(route.type, route.filter)));
      for (const count of workTabCountQueries(route.type)) client.prefetchQuery(count);
      return;
    case 'notifications':
      client.prefetchInfiniteQuery(notificationsQuery(viewOf(url)));
      return;
    case 'search':
      prefetchSearch(client, route);
      return;
  }
}

/**
 * The background's client for one page's early requests (see github/early.ts). Nothing stays cached once they
 * end, and none retries, also a query that sets its own retries (`STATS_RETRY`): a page whose request failed
 * makes its own.
 */
export function earlyClient() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  const defaulted = client.defaultQueryOptions.bind(client);
  client.defaultQueryOptions = (options) => ({ ...defaulted(options), retry: false });
  return client;
}

/** At most this many rows are prefetched per screen of a list. */
const ROWS_PER_SCREEN = 10;
/** How long a list's rows on screen stay the same (no scrolling) before their prefetch starts. */
const SETTLE_MS = 400;
/** A first paint fetched this recently isn't fetched again. An older one still paints at once; the page refetches it. */
const FRESH_MS = 5 * 60_000;
/** Prefetch requests in flight at once, so they don't crowd out the page's own. */
const PARALLEL = 2;
/** Connections too slow for requests the user may never need (Network Information's `effectiveType`). */
const SLOW = new Set(['slow-2g', '2g', '3g']);

/**
 * Prefetches the first paint of the pull requests and issues in a list's rows (`a[data-row]` in `list`) while
 * they stay on screen, so opening one is a repeat visit even without a hover. It starts once the rows on
 * screen have stayed the same for SETTLE_MS and the main thread is idle; scrolling cancels what hasn't started.
 * Call it again when the rows change; it returns the cleanup.
 */
export function prefetchVisibleRows(client: QueryClient, list: HTMLElement) {
  const rows = [...list.querySelectorAll<HTMLAnchorElement>('a[data-row]')];
  const onScreen = new Set<Element>();
  let queue: ReturnType<typeof rowsToPrefetch<HTMLAnchorElement>> = [];
  let running = 0;
  let settle: ReturnType<typeof setTimeout> | undefined;
  let idle: number | undefined;

  const next = () => {
    while (running < PARALLEL) {
      const item = queue.shift();
      if (!item) return;
      if (!onScreen.has(item.row) || document.hidden) continue;
      running++;
      item.query.prefetch(client).finally(() => {
        running--;
        next();
      });
    }
  };
  const start = () => {
    if (document.hidden || !canPrefetch()) return;
    queue = rowsToPrefetch(client, rows.filter((row) => onScreen.has(row)));
    next();
  };
  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) onScreen.add(target);
      else onScreen.delete(target);
    }
    queue = [];
    clearTimeout(settle);
    if (idle !== undefined) cancelIdleCallback(idle);
    settle = setTimeout(() => (idle = requestIdleCallback(start, { timeout: 1000 })), SETTLE_MS);
  });
  for (const row of rows) observer.observe(row);
  return () => {
    observer.disconnect();
    clearTimeout(settle);
    if (idle !== undefined) cancelIdleCallback(idle);
    queue = [];
  };
}

/**
 * Of a list's rows on screen (top to bottom), the ones whose first paint to prefetch, with its query: links to a
 * pull request or issue that isn't fresh, each once, at most ROWS_PER_SCREEN.
 */
export function rowsToPrefetch<Row extends { href: string }>(client: QueryClient, rows: Row[]) {
  const picked = new Map<string, { row: Row; query: NonNullable<ReturnType<typeof firstPaintQuery>> }>();
  for (const row of rows) {
    if (picked.size === ROWS_PER_SCREEN) break;
    const url = new URL(row.href);
    const route = url.origin === 'https://github.com' ? matchRoute(url) : null;
    const query = route && firstPaintQuery(route);
    if (!query) continue;
    const hash = hashKey(query.queryKey);
    if (!picked.has(hash) && !isFresh(client, query.queryKey)) picked.set(hash, { row, query });
  }
  return [...picked.values()];
}

// Its key and its prefetch: one shape for the pull request's and the issue's query, whose data types differ.
const firstPaintOf = <TData, TKey extends QueryKey>(options: FetchQueryOptions<TData, Error, TData, TKey, never>) => ({
  queryKey: options.queryKey,
  prefetch: (client: QueryClient) => client.prefetchQuery(options),
});

/** The query a pull request's or issue's page paints first (see `prefetchRoute`); none for other pages. */
function firstPaintQuery(route: Route) {
  if (route.kind === 'pr') return firstPaintOf(prQuery(route.owner, route.repo, route.number));
  if (route.kind === 'issue') return firstPaintOf(issueQuery(route.owner, route.repo, route.number));
}

/** Whether a query has run within FRESH_MS, or still runs. */
function isFresh(client: QueryClient, queryKey: QueryKey) {
  const state = client.getQueryState(queryKey);
  return !!state && (state.fetchStatus !== 'idle' || Date.now() - Math.max(state.dataUpdatedAt, state.errorUpdatedAt) < FRESH_MS);
}

/** No prefetch on a touch-only device, or on a metered or slow connection: the requests may never pay off. */
function canPrefetch() {
  const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return matchMedia('(any-hover: hover)').matches && !connection?.saveData && !SLOW.has(connection?.effectiveType ?? '');
}
