import { infiniteQueryOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql, rest, searchCode } from '@/github/client';
import { persisted } from '@/lib/persist';
import { SEARCH_TYPES, type Route, type SearchType } from '@/lib/routes';
import { PERSON_FIELDS, REPO_ROW_FIELDS, type OwnedRepo, type Person } from '@/pages/profile/queries';
import { workListQuery } from '@/pages/work/queries';

export type SearchRoute = Extract<Route, { kind: 'search' }>;

const WORK_SORTS = { '': 'Best match', 'created-desc': 'Newest', 'created-asc': 'Oldest', 'comments-desc': 'Most commented', 'updated-desc': 'Recently updated' };

/** Each tab's sorts as GitHub's `s` and `o` joined ("stars-desc"; '' is best match), with their labels. */
export const SORTS: Record<SearchType, Record<string, string>> = {
  repositories: { '': 'Best match', 'stars-desc': 'Most stars', 'forks-desc': 'Most forks', 'updated-desc': 'Recently updated' },
  // GitHub's code search has no sort.
  code: { '': 'Best match' },
  issues: WORK_SORTS,
  pullrequests: WORK_SORTS,
  users: { '': 'Best match', 'followers-desc': 'Most followers', 'repositories-desc': 'Most repositories', 'joined-desc': 'Newest' },
  commits: { '': 'Best match', 'author-date-desc': 'Newest', 'author-date-asc': 'Oldest' },
};

/** The route's sort if its tab has it, else best match. */
export const sortOf = ({ type, sort }: Pick<SearchRoute, 'type' | 'sort'>) => (Object.hasOwn(SORTS[type], sort) ? sort : '');

/** GitHub's URL for a search: `/search?q=…&type=…`, plus `s` and `o` when sorted. */
export function searchHref({ q, type, sort }: Pick<SearchRoute, 'q' | 'type' | 'sort'>) {
  const params = new URLSearchParams({ q, type });
  if (sort) {
    const dash = sort.lastIndexOf('-');
    params.set('s', sort.slice(0, dash));
    params.set('o', sort.slice(dash + 1));
  }
  return `/search?${params}`;
}

/** The GraphQL search for a tab: `is:issue`/`is:pr` narrows the shared issue index, `sort:` orders it. */
function graphQuery(q: string, type: SearchType, sort = '') {
  const kind = type === 'issues' ? ' is:issue' : type === 'pullrequests' ? ' is:pr' : '';
  return `${q}${kind}${sort ? ` sort:${sort}` : ''}`;
}

/** One page of a tab's results, the same shape for GraphQL (cursor) and REST (page number) searches. */
export type Page<T, P> = { total: number; items: T[]; next: P | null };

type Connection<T> = { count: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] };

const fromConnection = <T>({ count, pageInfo, nodes }: Connection<T>): Page<T, string> => ({
  total: count,
  items: nodes,
  next: pageInfo.hasNextPage ? pageInfo.endCursor : null,
});

const REPOS_QUERY = /* GraphQL */ `
  query SearchRepos($q: String!, $after: String) {
    search(type: REPOSITORY, query: $q, first: 25, after: $after) {
      count: repositoryCount
      pageInfo { hasNextPage endCursor }
      nodes { ...RepoRow }
    }
  }
  ${REPO_ROW_FIELDS}
`;

const USERS_QUERY = /* GraphQL */ `
  query SearchUsers($q: String!, $after: String) {
    search(type: USER, query: $q, first: 25, after: $after) {
      count: userCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ...Person
        ... on Organization { id login name avatarUrl bio: description location }
      }
    }
  }
  ${PERSON_FIELDS}
`;

type OrgNode = Pick<Person, 'id' | 'login' | 'name' | 'avatarUrl' | 'bio' | 'location'>;

/** An organization as a `Person` row: no company, followers or follow button. */
const asPerson = (node: Person | OrgNode): Person =>
  'isViewer' in node
    ? node
    : { ...node, company: null, isViewer: false, viewerIsFollowing: false, viewerCanFollow: false, isFollowingViewer: false, followers: null };

export const repoSearchQuery = (q: string, sort: string) =>
  infiniteQueryOptions({
    queryKey: ['search', 'repositories', graphQuery(q, 'repositories', sort)],
    queryFn: async ({ pageParam, signal }) =>
      fromConnection((await gql<{ search: Connection<OwnedRepo> }>(REPOS_QUERY, { q: graphQuery(q, 'repositories', sort), after: pageParam }, false, signal)).search),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    staleTime: 60_000,
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<Page<OwnedRepo, string>>,
  });

export const userSearchQuery = (q: string, sort: string) =>
  infiniteQueryOptions({
    queryKey: ['search', 'users', graphQuery(q, 'users', sort)],
    queryFn: async ({ pageParam, signal }) => {
      const { search } = await gql<{ search: Connection<Person | OrgNode> }>(USERS_QUERY, { q: graphQuery(q, 'users', sort), after: pageParam }, false, signal);
      return fromConnection({ ...search, nodes: search.nodes.map(asPerson) });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    staleTime: 60_000,
    persister: persisted<Page<Person, string>>,
  });

/** Issues or pull requests: the work lists' own query, so rows and cache are shared with them. */
export const workSearchQuery = (q: string, type: 'issues' | 'pullrequests', sort: string) => workListQuery(graphQuery(q, type, sort));

/** A matched stretch of a code result. `indices` are UTF-8 byte offsets into `fragment`. */
export type TextMatch = { fragment: string; matches: { indices: [number, number] }[] };

export type CodeResult = { path: string; url: string; repo: string; avatarUrl: string; fragments: TextMatch[] };

export type CommitResult = { sha: string; url: string; headline: string; date: string; repo: string; author: { login: string; avatarUrl: string } | null; authorName: string };

type RestRepo = { full_name: string; owner: { avatar_url: string } };
type RestCode = { path: string; html_url: string; repository: RestRepo; text_matches?: TextMatch[] };
type RestCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string; avatar_url: string } | null;
  repository: RestRepo;
};

const PER_PAGE = 30;

type RestResults<T> = { total_count: number; items: T[] };

/**
 * One page of a REST search (code and commits aren't in GraphQL's): `get` fetches it for the query string. Search
 * answers at most 1,000 results. They're slimmed to what the rows show, since GitHub's items are mostly URLs and
 * they're stored.
 */
async function restSearch<T, R>(get: (params: string) => Promise<RestResults<T>>, params: Record<string, string>, page: number, slim: (item: T) => R): Promise<Page<R, number>> {
  const { total_count: total, items } = await get(String(new URLSearchParams({ ...params, per_page: String(PER_PAGE), page: String(page) })));
  return { total, items: items.map(slim), next: page * PER_PAGE < Math.min(total, 1000) ? page + 1 : null };
}

export const codeSearchQuery = (q: string) =>
  infiniteQueryOptions({
    queryKey: ['search', 'code', q],
    queryFn: ({ pageParam }) =>
      restSearch(searchCode<RestResults<RestCode>>, { q }, pageParam, (item): CodeResult => ({
        path: item.path,
        url: item.html_url,
        repo: item.repository.full_name,
        avatarUrl: item.repository.owner.avatar_url,
        fragments: (item.text_matches ?? []).map(({ fragment, matches }) => ({ fragment, matches: matches.map(({ indices }) => ({ indices })) })),
      })),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next,
    staleTime: 60_000,
    persister: persisted<Page<CodeResult, number>>,
  });

export const commitSearchQuery = (q: string, sort: string) =>
  infiniteQueryOptions({
    queryKey: ['search', 'commits', q, sort],
    queryFn: ({ pageParam, signal }) => {
      const dash = sort.lastIndexOf('-');
      const params: Record<string, string> = sort ? { q, sort: sort.slice(0, dash), order: sort.slice(dash + 1) } : { q };
      const get = (search: string) => rest<RestResults<RestCommit>>(`/search/commits?${search}`, { signal });
      return restSearch(get, params, pageParam, (item): CommitResult => ({
        sha: item.sha,
        url: item.html_url,
        headline: item.commit.message.split('\n', 1)[0] ?? '',
        date: item.commit.author.date,
        repo: item.repository.full_name,
        author: item.author && { login: item.author.login, avatarUrl: item.author.avatar_url },
        authorName: item.commit.author.name,
      }));
    },
    initialPageParam: 1,
    getNextPageParam: (last) => last.next,
    staleTime: 60_000,
    persister: persisted<Page<CommitResult, number>>,
  });

// The tabs counted ahead, each by a GraphQL search and the count it answers with. Code and commits are counted
// only by their own results: a count there would spend REST search's rate limit (10 a minute for code) on every search.
const COUNTED = {
  repositories: ['REPOSITORY', 'repositoryCount'],
  issues: ['ISSUE', 'issueCount'],
  pullrequests: ['ISSUE', 'issueCount'],
  users: ['USER', 'userCount'],
} as const satisfies Partial<Record<SearchType, readonly [string, string]>>;

export type CountedType = keyof typeof COUNTED;
export const isCounted = (type: SearchType): type is CountedType => Object.hasOwn(COUNTED, type);

/** A tab's result count for `q`. One request each, so they run in parallel with the results. */
export const searchCountQuery = (q: string, type: CountedType) =>
  queryOptions({
    queryKey: ['search-count', type, q],
    queryFn: async () => {
      const [searchType, field] = COUNTED[type];
      const query = `query SearchCount($q: String!) { search(type: ${searchType}, query: $q, first: 0) { count: ${field} } }`;
      return (await gql<{ search: { count: number } }>(query, { q: graphQuery(q, type) })).search.count;
    },
    enabled: q !== '',
    staleTime: 60_000,
    persister: persisted,
  });

/** Starts a search page's results and its tab counts. */
export function prefetchSearch(client: QueryClient, route: SearchRoute) {
  const { q, type } = route;
  if (!q) return;
  const sort = sortOf(route);
  for (const tab of SEARCH_TYPES.filter(isCounted)) client.prefetchQuery(searchCountQuery(q, tab));
  if (type === 'repositories') client.prefetchInfiniteQuery(repoSearchQuery(q, sort));
  else if (type === 'users') client.prefetchInfiniteQuery(userSearchQuery(q, sort));
  else if (type === 'issues' || type === 'pullrequests') client.prefetchInfiniteQuery(workSearchQuery(q, type, sort));
  else if (type === 'code') client.prefetchInfiniteQuery(codeSearchQuery(q));
  else client.prefetchInfiniteQuery(commitSearchQuery(q, sort));
}
