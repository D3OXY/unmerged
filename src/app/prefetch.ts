import type { QueryClient } from '@tanstack/react-query';
import { achievementsQuery } from '@/github/achievements';
import type { Route } from '@/lib/routes';
import { prefetchHome } from '@/pages/home/queries';
import { issueQuery } from '@/pages/issue/query';
import { notificationsQuery, viewOf } from '@/pages/notifications/queries';
import { prefetchPr } from '@/pages/pr/query';
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
import { defaultQuery, prefetchWorkList, repoListQuery, workQueryOf, workTabCountQueries } from '@/pages/work/queries';

/**
 * Starts the requests a page makes when it opens, so they're under way (or done) by the time it renders:
 * at page load, before React and our styles are ready, and when a link to the page is hovered or pressed.
 * These are the pages' own query options, so nothing is fetched twice and fresh data isn't refetched.
 */
export function prefetchRoute(client: QueryClient, route: Route, url: URL) {
  switch (route.kind) {
    case 'home':
      prefetchHome(client);
      return;
    case 'profile': {
      const { login, tab } = route;
      client.prefetchQuery(achievementsQuery(login));
      if (tab === 'overview') {
        client.prefetchQuery(profileUserQuery(login));
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
    case 'repo':
      if (route.view === 'issues' || route.view === 'pulls') {
        client.prefetchQuery(repoQuery(route.owner, route.repo));
        prefetchWorkList(client, workQueryOf(url, repoListQuery(route.view)), `${route.owner}/${route.repo}`);
      } else prefetchRepo(client, route.owner, route.repo, route.view, route.rest);
      return;
    case 'issue':
      client.prefetchQuery(repoQuery(route.owner, route.repo));
      client.prefetchQuery(issueQuery(route.owner, route.repo, route.number));
      return;
    case 'pr':
      prefetchPr(client, route.owner, route.repo, route.number, route.tab);
      return;
    case 'work':
      prefetchWorkList(client, workQueryOf(url, defaultQuery(route.type, route.filter)));
      for (const count of workTabCountQueries(route.type)) client.prefetchQuery(count);
      return;
    case 'notifications':
      client.prefetchInfiniteQuery(notificationsQuery(viewOf(url)));
      return;
  }
}
