import { infiniteQueryOptions, queryOptions, useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { gql } from '@/github/client';
import type { Actor } from '@/github/types';
import { persisted } from '@/lib/persist';
import type { Peek, WorkFilter } from '@/lib/routes';
import { issueSplitItem, nestIssuesItem } from '@/lib/settings';
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

// What a nested list also needs: which results are sub-issues (`parent`) and which have sub-issues of their own.
const NESTING = 'parent { id number title url state stateReason repository { nameWithOwner isPrivate } } subIssues { totalCount }';

const listQuery = (nested: boolean) => /* GraphQL */ `
  query WorkList($q: String!, $after: String) {
    results: search(type: ISSUE, query: $q, first: 50, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename
        ... on PullRequest { ${ROW} isDraft state }
        ... on Issue { ${ROW} state stateReason ${nested ? NESTING : ''} }
      }
    }
  }
`;

type ListFields = { createdAt: string; repository: { nameWithOwner: string; owner: { avatarUrl: string } } };

export type PrItem = { __typename: 'PullRequest' } & PrRowItem & ListFields;
/** The issue an issue is a sub-issue of. */
export type IssueParent = Pick<IssueRowItem, 'id' | 'number' | 'title' | 'url' | 'state' | 'stateReason' | 'repository'>;
/** `parent` and `subIssues` come only in a nested list (see `NESTING`). */
type IssueItem = { __typename: 'Issue'; parent?: IssueParent | null; subIssues?: { totalCount: number } } & IssueRowItem & ListFields;
/** A list result: a search can mix pull requests and issues whatever the page is for. */
export type WorkItem = PrItem | IssueItem;

export type ListPage = {
  results: { issueCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: WorkItem[] };
};

/**
 * One search, 50 results a page. `repo` ("owner/name") scopes the search without being part of `q`, as on GitHub.
 * `nested` (the Nest sub-issues setting, issue lists only) also asks for what nesting needs.
 */
export const workListQuery = (q: string, repo?: string, nested = false) =>
  infiniteQueryOptions({
    // Stored results paint before the request returns, so the key changes whenever their shape does.
    queryKey: ['work-list', repo?.toLowerCase(), q, nested],
    queryFn: ({ pageParam }) => gql<ListPage>(listQuery(nested), { q: scoped(q, repo), after: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.results.pageInfo.hasNextPage ? last.results.pageInfo.endCursor : null),
    staleTime: 30_000,
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<ListPage>,
  });

/** The parents whose sub-issues a nested list shows: each result's parent, and each result that has sub-issues. */
export function familyIds(items: WorkItem[]) {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.__typename !== 'Issue') continue;
    if (item.parent) ids.add(item.parent.id);
    if (item.subIssues?.totalCount) ids.add(item.id);
  }
  return [...ids];
}

// GitHub allows 100 sub-issues per issue, so one page holds them all.
const FAMILY_QUERY = /* GraphQL */ `
  query IssueFamily($id: ID!) {
    node(id: $id) { ... on Issue { subIssues(first: 100) { nodes { __typename ${ROW} state stateReason } } } }
  }
`;

/** All sub-issues of the issue `id`, in GitHub's order (the order on the issue's page). */
export const issueFamilyQuery = (id: string) =>
  queryOptions({
    queryKey: ['issue-family', id],
    // A sub-issue the token can't see comes back null.
    queryFn: async ({ signal }) =>
      (await gql<{ node: { subIssues: { nodes: (WorkItem | null)[] } } | null }>(FAMILY_QUERY, { id }, true, signal)).node?.subIssues.nodes.filter((node) => node !== null) ?? [],
    staleTime: 30_000,
    persister: persisted,
  });

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
// (a tab's count is also the Open count beside its closed list).
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

/** The states whose counts sit beside a list's search, in that order. */
export const STATES = ['open', 'closed'] as const;

/** The state that `q` lists, when all its state qualifiers ask for the same one of `STATES`. */
export function listedState(q: string) {
  const states = new Set(q.match(tokens('state'))?.map((token) => token.slice(token.indexOf(':') + 1)));
  const [state] = states;
  return states.size === 1 && (state === 'open' || state === 'closed') ? state : undefined;
}

/**
 * The Open and Closed counts beside a list's search, in `STATES` order. The count of the state that the search
 * lists (`listedState`) is the list's own `issueCount`, so that query is disabled: it would ask for the same number.
 */
export const workStateCountQueries = (q: string, repo?: string) => {
  const listed = listedState(q);
  return STATES.map((state) => ({ ...workCountQuery(scoped(withQualifier(q, 'state', `is:${state}`), repo)), enabled: state !== listed }));
};

/** The open count of each tab's default search, in `TABS` order. */
export const workTabCountQueries = (type: WorkType) => TABS[type].map((tab) => workCountQuery(defaultQuery(type, tab.filter)));

/**
 * Starts everything a list shows for `q` at once: its results and the Open/Closed counts they don't hold. Then
 * the table's details follow the results; a nested issue list starts its families instead, and a split one
 * neither. Resolves once those have started.
 */
export async function prefetchWorkList(client: QueryClient, kind: WorkType, q: string, repo?: string) {
  for (const count of workStateCountQueries(q, repo)) if (count.enabled) client.prefetchQuery(count);
  try {
    const [split, nested] = kind === 'issue' ? await Promise.all([issueSplitItem.getValue(), nestIssuesItem.getValue()]) : [false, false];
    const { pages } = await client.fetchInfiniteQuery(workListQuery(q, repo, nested));
    const items = pages.flatMap((page) => page.results.nodes);
    if (nested) for (const id of familyIds(items)) client.prefetchQuery(issueFamilyQuery(id));
    else if (!split) for (const ids of detailChunks(items)) client.prefetchQuery(workDetailsQuery(ids));
  } catch {
    // The page shows the error when it asks again.
  }
}
