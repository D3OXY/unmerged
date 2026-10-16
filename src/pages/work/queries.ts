import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { gql } from '@/github/client';
import { persisted } from '@/lib/persist';
import type { WorkFilter } from '@/lib/routes';
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

/** The search a list URL shows: its `?q=`, or the tab's default. */
export const workQueryOf = (url: URL, type: WorkType, filter: WorkFilter) => url.searchParams.get('q') || defaultQuery(type, filter);

// GitHub's newer pages write `state:open`; both mean the same.
export const STATE = /(^|\s)(?:is|state):(open|closed|merged)(?=\s|$)/g;
export const squash = (q: string) => q.replace(/\s+/g, ' ').trim();

/** The query with its state qualifier set: first, where GitHub puts it. */
export const withState = (q: string, state: 'open' | 'closed') => squash(`is:${state} ${q.replace(STATE, ' ')}`);

const LIST_QUERY = /* GraphQL */ `
  query WorkList($q: String!, $open: String!, $closed: String!, $after: String, $counts: Boolean!) {
    results: search(type: ISSUE, query: $q, first: 50, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes { __typename ...PrRow ...IssueRow }
    }
    open: search(type: ISSUE, query: $open, first: 0) @include(if: $counts) { issueCount }
    closed: search(type: ISSUE, query: $closed, first: 0) @include(if: $counts) { issueCount }
  }
  ${PR_ROW_FIELDS}
  ${ISSUE_ROW_FIELDS}
`;

type Item = ({ __typename: 'PullRequest' } & PrRowData) | ({ __typename: 'Issue' } & IssueRowData);
export type ListPage = {
  results: { issueCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Item[] };
  open?: { issueCount: number };
  closed?: { issueCount: number };
};

/** A repo's own list (`/owner/repo/issues`, `/pulls`) for a bare URL. */
export const repoListQuery = (tab: 'issues' | 'pulls') => (tab === 'issues' ? 'is:open is:issue' : 'is:open is:pr');

/**
 * One search, 50 results a page; the first page also counts its open and closed matches. `repo`
 * ("owner/name") scopes the search without being part of `q`, as on GitHub.
 */
export const workListQuery = (q: string, repo?: string) => {
  const scoped = (query: string) => (repo ? `${query} repo:${repo}` : query);
  return infiniteQueryOptions({
    queryKey: ['work', repo?.toLowerCase(), q],
    queryFn: ({ pageParam }) =>
      gql<ListPage>(LIST_QUERY, {
        q: scoped(q),
        open: scoped(withState(q, 'open')),
        closed: scoped(withState(q, 'closed')),
        after: pageParam,
        counts: pageParam === null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.results.pageInfo.hasNextPage ? last.results.pageInfo.endCursor : null),
    staleTime: 30_000,
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<ListPage>,
  });
};

/** Open counts for each tab's default search, in one request. */
export const workTabsQuery = (type: WorkType) =>
  queryOptions({
    queryKey: ['work-tabs', type],
    queryFn: async () => {
      const tabs = TABS[type];
      const fields = tabs.map((tab, i) => `t${i}: search(type: ISSUE, first: 0, query: ${JSON.stringify(defaultQuery(type, tab.filter))}) { issueCount }`);
      const data = await gql<Record<string, { issueCount: number }>>(`query WorkTabs { ${fields.join(' ')} }`);
      return tabs.map((_, i) => data[`t${i}`]?.issueCount ?? 0);
    },
    staleTime: 60_000,
    persister: persisted,
  });
