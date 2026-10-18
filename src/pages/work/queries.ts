import { infiniteQueryOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql } from '@/github/client';
import type { Actor } from '@/github/types';
import { persisted } from '@/lib/persist';
import type { Peek, WorkFilter } from '@/lib/routes';
import { ISSUE_ROW_FIELDS, PR_ROW_FIELDS, type IssueRowData, type PrRowData } from '@/ui/WorkRow';

export type WorkType = 'pr' | 'issue';

export const TABS: Record<WorkType, { filter: WorkFilter; label: string; path: string }[]> = {
  pr: [
    { filter: 'created', label: 'Created', path: '/pulls' },
    { filter: 'assigned', label: 'Assigned', path: '/pulls/assigned' },
    { filter: 'mentioned', label: 'Mentioned', path: '/pulls/mentioned' },
    { filter: 'review-requested', label: 'Review requests', path: '/pulls/review-requested' },
  ],
  issue: [
    { filter: 'created', label: 'Created', path: '/issues' },
    { filter: 'assigned', label: 'Assigned', path: '/issues/assigned' },
    { filter: 'mentioned', label: 'Mentioned', path: '/issues/mentioned' },
  ],
};

const QUALIFIER: Record<WorkFilter, string> = {
  created: 'author:@me',
  assigned: 'assignee:@me',
  mentioned: 'mentions:@me',
  'review-requested': 'review-requested:@me',
};

/** What GitHub's own page searches for a tab, so plain `/pulls` links mean the same thing here. */
export const defaultQuery = (type: WorkType, filter: WorkFilter) => `is:open is:${type} ${QUALIFIER[filter]} archived:false sort:updated-desc`;

/** A repo's own list (`/owner/repo/issues`, `/pulls`) for a bare URL. */
export const repoListQuery = (tab: 'issues' | 'pulls') => (tab === 'issues' ? 'is:open is:issue' : 'is:open is:pr');

/** The search a list URL shows: its `?q=`, or `fallback`, the query for the bare URL. The page and prefetch both read it. */
export const workQueryOf = (url: URL, fallback: string) => url.searchParams.get('q') || fallback;

export const squash = (q: string) => q.replace(/\s+/g, ' ').trim();

const VALUE = String.raw`(?:"[^"]*"|\S+)`;

/** The qualifiers the list's controls edit, each pattern matching one whole token of the search. */
const QUALIFIERS = {
  // GitHub's newer pages write `state:open`; both mean the same.
  state: '(?:is|state):(?:open|closed|merged)',
  sort: `sort:${VALUE}`,
  author: `author:${VALUE}`,
  label: `label:${VALUE}`,
  review: `review(?:-requested)?:${VALUE}`,
  ci: `status:${VALUE}`,
};
export type Qualifier = keyof typeof QUALIFIERS;

const tokens = (name: Qualifier) => new RegExp(String.raw`(?<=^|\s)${QUALIFIERS[name]}(?=\s|$)`, 'g');

/** The first `name` qualifier in `q` as written (e.g. `sort:created-asc`), or '' when it has none. */
export const qualifierOf = (q: string, name: Qualifier) => q.match(tokens(name))?.[0] ?? '';

/** `q` with its `name` qualifiers replaced by `token` ('' removes them). State goes first, where GitHub puts it. */
export const withQualifier = (q: string, name: Qualifier, token: string) => {
  const rest = q.replace(tokens(name), ' ');
  return squash(name === 'state' ? `${token} ${rest}` : `${rest} ${token}`);
};

/** The orders a list offers, as GitHub's `sort:` values. */
export const SORTS = {
  'updated-desc': 'Recently updated',
  'created-desc': 'Newest',
  'created-asc': 'Oldest',
  'comments-desc': 'Most commented',
} as const;
export type Sort = keyof typeof SORTS;

const isSort = (value: string): value is Sort => Object.hasOwn(SORTS, value);
/** The order `q` asks for. Search without a sort qualifier returns newest first. */
export const sortOf = (q: string): Sort => {
  const sort = qualifierOf(q, 'sort').slice('sort:'.length);
  return isSort(sort) ? sort : 'created-desc';
};

/** Whether `item` is the pull request or issue `peek` opens. */
export const isPeek = (item: { number: number; repository: { nameWithOwner: string } }, peek: Peek | undefined) =>
  !!peek && item.number === peek.number && item.repository.nameWithOwner.toLowerCase() === `${peek.owner}/${peek.repo}`.toLowerCase();

const scoped = (q: string, repo?: string) => (repo ? `${q} repo:${repo}` : q);

// Beyond the shared row fragments, the lists show diff size, reviewers, creation time and the repo's owner.
const LIST_QUERY = /* GraphQL */ `
  query WorkList($q: String!, $after: String) {
    results: search(type: ISSUE, query: $q, first: 50, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename ...PrRow ...IssueRow
        ... on PullRequest {
          createdAt additions deletions
          repository { owner { avatarUrl } }
          latestOpinionatedReviews(first: 3) { nodes { author { login avatarUrl } } }
          reviewRequests(first: 3) { nodes { requestedReviewer { ... on User { login avatarUrl } ... on Team { name avatarUrl } } } }
        }
        ... on Issue { createdAt repository { owner { avatarUrl } } }
      }
    }
  }
  ${PR_ROW_FIELDS}
  ${ISSUE_ROW_FIELDS}
`;

type ListFields = { createdAt: string; repository: { nameWithOwner: string; owner: { avatarUrl: string } } };

export type PrItem = { __typename: 'PullRequest' } & PrRowData &
  ListFields & {
    additions: number;
    deletions: number;
    latestOpinionatedReviews: { nodes: { author: Actor }[] };
    // A user or a team; bots and mannequins come back empty.
    reviewRequests: { nodes: { requestedReviewer: { login?: string; name?: string; avatarUrl?: string } | null }[] };
  };
type IssueItem = { __typename: 'Issue' } & IssueRowData & ListFields;
/** A list result: a search can mix pull requests and issues whatever the page is for. */
export type WorkItem = PrItem | IssueItem;

export type ListPage = {
  results: { issueCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: WorkItem[] };
};

/** One search, 50 results a page. `repo` ("owner/name") scopes the search without being part of `q`, as on GitHub. */
export const workListQuery = (q: string, repo?: string) =>
  infiniteQueryOptions({
    // Stored results paint before the request returns, so the key changes whenever their shape does.
    queryKey: ['work-list', repo?.toLowerCase(), q],
    queryFn: ({ pageParam }) => gql<ListPage>(LIST_QUERY, { q: scoped(q, repo), after: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.results.pageInfo.hasNextPage ? last.results.pageInfo.endCursor : null),
    staleTime: 30_000,
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<ListPage>,
  });

// Each count is its own request: GitHub runs one query's searches one after another, so bundled they'd wait on
// each other and on the list. Sort doesn't change a count, so it's dropped and equal counts share a cache entry
// (a tab's count is also its list's Open count).
const workCountQuery = (q: string) => {
  const query = withQualifier(q, 'sort', '');
  return queryOptions({
    queryKey: ['work-count', query],
    queryFn: async () =>
      (await gql<{ search: { issueCount: number } }>(`query WorkCount($q: String!) { search(type: ISSUE, first: 0, query: $q) { issueCount } }`, { q: query })).search.issueCount,
    staleTime: 60_000,
    persister: persisted,
  });
};

/** The Open and Closed counts beside a list's search, in that order. */
export const workStateCountQueries = (q: string, repo?: string) => (['open', 'closed'] as const).map((state) => workCountQuery(scoped(withQualifier(q, 'state', `is:${state}`), repo)));

/** The open count of each tab's default search, in `TABS` order. */
export const workTabCountQueries = (type: WorkType) => TABS[type].map((tab) => workCountQuery(defaultQuery(type, tab.filter)));

/** Starts everything a list shows for `q` at once: its results and its Open/Closed counts. */
export function prefetchWorkList(client: QueryClient, q: string, repo?: string) {
  client.prefetchInfiniteQuery(workListQuery(q, repo));
  for (const count of workStateCountQueries(q, repo)) client.prefetchQuery(count);
}
