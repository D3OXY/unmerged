import { useQuery } from '@tanstack/react-query';
import { localCache } from '@/lib/localCache';
import { gql, rest } from './client';

/** What the sidebar needs to draw a repo. */
export type RepoSummary = { nameWithOwner: string; isPrivate: boolean };

// Events that mean "I worked here". Stars, forks and follows don't.
const WORK_EVENTS = new Set([
  'PushEvent', 'PullRequestEvent', 'PullRequestReviewEvent', 'PullRequestReviewCommentEvent',
  'IssuesEvent', 'IssueCommentEvent', 'CommitCommentEvent', 'CreateEvent', 'ReleaseEvent',
]);

const BACKFILL_QUERY = /* GraphQL */ `
  query RecentRepos {
    viewer {
      repositories(first: 20, orderBy: { field: PUSHED_AT, direction: DESC }, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
        nodes { nameWithOwner pushedAt }
      }
      repositoriesContributedTo(
        first: 20
        includeUserRepositories: true
        contributionTypes: [COMMIT, PULL_REQUEST, PULL_REQUEST_REVIEW, ISSUE]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes { nameWithOwner pushedAt }
      }
    }
  }
`;

type Backfill = { viewer: Record<'repositories' | 'repositoriesContributedTo', { nodes: { nameWithOwner: string; pushedAt: string | null }[] }> };

const RECENT_LIMIT = 15;

/**
 * Repos the user worked in, most recent first: their own activity feed (pushes, PRs, reviews, comments)
 * leads, then repos they own or contribute to, by last push. Repos they can no longer see are dropped.
 */
async function fetchRecentRepos(login: string): Promise<RepoSummary[]> {
  const [events, backfill] = await Promise.all([
    rest<{ type: string; repo: { name: string } }[]>(`/users/${login}/events?per_page=100`),
    gql<Backfill>(BACKFILL_QUERY),
  ]);
  const byPush = [...backfill.viewer.repositories.nodes, ...backfill.viewer.repositoriesContributedTo.nodes]
    .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''))
    .map((r) => r.nameWithOwner);
  const names = [...events.filter((e) => WORK_EVENTS.has(e.type)).map((e) => e.repo.name), ...byPush];
  const unique = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
  // Look up a few extra: the lookup drops repos the user can no longer see.
  return lookupRepos(unique.slice(0, RECENT_LIMIT + 5)).then((repos) => repos.slice(0, RECENT_LIMIT));
}

/** Resolves "owner/name"s in one request, in order, skipping any that don't exist or aren't visible. */
export async function lookupRepos(names: string[]): Promise<RepoSummary[]> {
  if (!names.length) return [];
  const parts = names.map((n) => n.split('/') as [string, string]);
  const query = `query Repos(${parts.map((_, i) => `$o${i}: String!, $n${i}: String!`).join(', ')}) {
    ${parts.map((_, i) => `r${i}: repository(owner: $o${i}, name: $n${i}) { nameWithOwner isPrivate }`).join('\n')}
  }`;
  const variables = Object.fromEntries(parts.flatMap(([owner, name], i) => [[`o${i}`, owner], [`n${i}`, name]]));
  const data = await gql<Record<string, RepoSummary | null>>(query, variables, true);
  return parts.flatMap((_, i) => data[`r${i}`] ?? []);
}

const recentCache = localCache<RepoSummary[]>('unmerged:recent-repos');

export function useRecentRepos(login: string | undefined) {
  return useQuery({
    queryKey: ['recent-repos', login],
    queryFn: async () => {
      const repos = await fetchRecentRepos(login!);
      recentCache.set(repos);
      return repos;
    },
    enabled: !!login,
    initialData: recentCache.get,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });
}

/** Private flags for pinned repos (the pins themselves are just names). */
export function usePinnedRepos(pins: string[] | null) {
  return useQuery({
    queryKey: ['pinned-repos', pins?.map((p) => p.toLowerCase()).join(',')],
    queryFn: () => lookupRepos(pins!),
    enabled: !!pins?.length,
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}
