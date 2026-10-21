import { infiniteQueryOptions, queryOptions, useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { gql } from '@/github/client';
import type { Actor } from '@/github/types';
import { persisted } from '@/lib/persist';
import type { Peek, WorkFilter } from '@/lib/routes';
import { issueSplitItem } from '@/lib/settings';
import type { IssueRowDetails, IssueRowItem, PrRowDetails, PrRowItem } from '@/ui/WorkRow';

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

// The search asks only for what GitHub finds fast: 50 results in about 0.6 s. Comments, review, CI and size it
// works out one result after another (about 5 s for 50), so those come after, by id (`workDetailsQuery`).
const ROW = 'id number title url updatedAt createdAt repository { nameWithOwner isPrivate owner { avatarUrl } } author { login avatarUrl } labels(first: 3) { nodes { name color } }';

const LIST_QUERY = /* GraphQL */ `
  query WorkList($q: String!, $after: String) {
    results: search(type: ISSUE, query: $q, first: 50, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename
        ... on PullRequest { ${ROW} isDraft state }
        ... on Issue { ${ROW} state stateReason parent { id number title url state stateReason repository { nameWithOwner isPrivate } } }
      }
    }
  }
`;

type ListFields = { createdAt: string; repository: { nameWithOwner: string; owner: { avatarUrl: string } } };

export type PrItem = { __typename: 'PullRequest' } & PrRowItem & ListFields;
/** The issue an issue is a sub-issue of. */
export type IssueParent = Pick<IssueRowItem, 'id' | 'number' | 'title' | 'url' | 'state' | 'stateReason' | 'repository'>;
type IssueItem = { __typename: 'Issue'; parent: IssueParent | null } & IssueRowItem & ListFields;
/** A list result: a search can mix pull requests and issues whatever the page is for. */
export type WorkItem = PrItem | IssueItem;

export type ListPage = {
  results: { issueCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: WorkItem[] };
};

/** One search, 50 results a page. `repo` ("owner/name") scopes the search without being part of `q`, as on GitHub. */
export const workListQuery = (q: string, repo?: string) =>
  infiniteQueryOptions({
    // Stored results paint before the request returns, so the key changes whenever their shape does.
    queryKey: ['work-list', 2, repo?.toLowerCase(), q],
    queryFn: ({ pageParam }) => gql<ListPage>(LIST_QUERY, { q: scoped(q, repo), after: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.results.pageInfo.hasNextPage ? last.results.pageInfo.endCursor : null),
    staleTime: 30_000,
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<ListPage>,
  });

/**
 * `items` under their parent issues, as GitHub Projects groups by parent: each group in the order its first
 * item comes in the list, then the items with no parent (pull requests too) in a group whose `parent` is null.
 */
export function groupByParent(items: WorkItem[]) {
  const groups = new Map<string, { parent: IssueParent | null; items: WorkItem[] }>();
  for (const item of items) {
    const parent = item.__typename === 'Issue' ? item.parent : null;
    const key = parent?.id ?? '';
    const group = groups.get(key) ?? groups.set(key, { parent, items: [] }).get(key)!;
    group.items.push(item);
  }
  // The sort is stable, so the groups keep their order.
  return [...groups.values()].sort((a, b) => Number(!a.parent) - Number(!b.parent));
}

const DETAILS_QUERY = /* GraphQL */ `
  query WorkDetails($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on PullRequest {
        id comments { totalCount } reviewDecision additions deletions
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        latestOpinionatedReviews(first: 3) { nodes { author { login avatarUrl } } }
        reviewRequests(first: 3) { nodes { requestedReviewer { ... on User { login avatarUrl } ... on Team { name avatarUrl } } } }
      }
      ... on Issue { id comments { totalCount } subIssuesSummary { total completed } issueDependenciesSummary { blockedBy } }
    }
  }
`;

export type PrDetails = { __typename: 'PullRequest'; id: string } & PrRowDetails & {
    additions: number;
    deletions: number;
    latestOpinionatedReviews: { nodes: { author: Actor }[] };
    // A user or a team; bots and mannequins come back empty.
    reviewRequests: { nodes: { requestedReviewer: { login?: string; name?: string; avatarUrl?: string } | null }[] };
  };
/** What a result shows beyond its search fields, by id. */
export type WorkDetails = PrDetails | ({ __typename: 'Issue'; id: string } & IssueRowDetails);

/** Results whose details one request asks for. GitHub answers 10 in about 1 s, and a page's requests run at once. */
const CHUNK = 10;

/** The ids of `items` in requests of CHUNK, in list order. A page holds 50, so no request spans two pages. */
export const detailChunks = (items: { id: string }[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK).map((item) => item.id));

/** The details of a few results (see `detailChunks`). A node GitHub can't give (deleted, or out of reach) is null. */
export const workDetailsQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ['work-details', ids],
    queryFn: async ({ signal }) => (await gql<{ nodes: (WorkDetails | null)[] }>(DETAILS_QUERY, { ids }, true, signal)).nodes,
    staleTime: 30_000,
    persister: persisted,
  });

type ChunkResult = { data?: (WorkDetails | null)[]; isError: boolean; isPlaceholderData: boolean };

/**
 * Each result's details from the requests for `chunks`, in the same order: missing while its request runs,
 * null when the request failed or GitHub had nothing for it.
 */
export function detailsById(chunks: string[][], results: ChunkResult[]) {
  const byId = new Map<string, WorkDetails | null>();
  chunks.forEach((ids, i) => {
    const { data, isError, isPlaceholderData } = results[i] ?? {};
    for (const node of data ?? []) if (node) byId.set(node.id, node);
    // Placeholder data is only what was known before; the rest is still on its way.
    if (isError || (data && !isPlaceholderData)) for (const id of ids) if (!byId.has(id)) byId.set(id, null);
  });
  return byId;
}

/**
 * Details already in the cache for any of `ids`, from earlier requests. When a refetch reorders a list, its
 * requests change; the rows keep what they showed until the new answers land.
 */
export function knownDetails(client: QueryClient, ids: string[]) {
  const wanted = new Set(ids);
  const known = client
    .getQueriesData<(WorkDetails | null)[]>({ queryKey: ['work-details'] })
    .flatMap(([, nodes]) => nodes?.filter((node) => node && wanted.has(node.id)) ?? []);
  return known.length ? known : undefined;
}

/** The details of `items` (see `detailsById`), CHUNK at a time, all requests at once. */
export function useWorkDetails(items: { id: string }[]) {
  const client = useQueryClient();
  const chunks = detailChunks(items);
  return useQueries({
    queries: chunks.map((ids) => ({ ...workDetailsQuery(ids), placeholderData: () => knownDetails(client, ids) })),
    combine: (results) => detailsById(chunks, results),
  });
}

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

/**
 * Starts everything a list shows for `q` at once: its results and its Open/Closed counts. The table's details
 * follow the results; a split issue list shows none. Resolves once the details have started.
 */
export function prefetchWorkList(client: QueryClient, kind: WorkType, q: string, repo?: string) {
  const details = Promise.all([client.fetchInfiniteQuery(workListQuery(q, repo)), kind === 'issue' && issueSplitItem.getValue()])
    .then(([{ pages }, split]) => {
      if (split) return;
      for (const ids of detailChunks(pages.flatMap((page) => page.results.nodes))) client.prefetchQuery(workDetailsQuery(ids));
    })
    .catch(() => {});
  for (const count of workStateCountQueries(q, repo)) client.prefetchQuery(count);
  return details;
}
