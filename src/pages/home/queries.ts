import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql } from '@/github/client';
import { persisted } from '@/lib/persist';
import { ISSUE_ROW_FIELDS, PR_ROW_FIELDS, type IssueRowData, type PrRowData } from '@/ui/WorkRow';

// The dashboard is five searches sent at once rather than one query: GitHub runs a query's searches one
// after another (~4 s together), and "your open PRs" alone can take 2.5 s. Each section shows when its
// search lands.

type Search<T> = { issueCount: number; nodes: T[] };

const search = <T,>(name: string, query: string, first: number, fragment: string, fields: string) =>
  queryOptions({
    queryKey: ['home', name],
    queryFn: async () =>
      (await gql<{ search: Search<T> }>(`query Home { search(type: ISSUE, first: ${first}, query: ${JSON.stringify(query)}) { issueCount nodes { ...${fragment} } } } ${fields}`))
        .search,
    staleTime: 30_000,
    persister: persisted,
  });

const MERGED_ROW_FIELDS = /* GraphQL */ `
  fragment MergedRow on PullRequest { id title url mergedAt repository { nameWithOwner } }
`;
export type MergedRow = { id: string; title: string; url: string; mergedAt: string; repository: { nameWithOwner: string } };

/** Local midnight a week ago, with its UTC offset, so "this week" follows your calendar rather than UTC's. */
function weekAgo() {
  const day = new Date();
  day.setDate(day.getDate() - 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -day.getTimezoneOffset();
  const zone = `${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T00:00:00${zone}`;
}

export const homeQueries = {
  reviewRequested: () => search<PrRowData>('review-requested', 'is:open is:pr review-requested:@me archived:false sort:updated-desc', 15, 'PrRow', PR_ROW_FIELDS),
  authored: () => search<PrRowData>('authored', 'is:open is:pr author:@me archived:false sort:updated-desc', 15, 'PrRow', PR_ROW_FIELDS),
  assigned: () => search<IssueRowData>('assigned', 'is:open is:issue assignee:@me archived:false sort:updated-desc', 15, 'IssueRow', ISSUE_ROW_FIELDS),
  // Search can't sort by merge time. Merging updates a PR, so recent merges are among the recently updated;
  // the page orders these by `mergedAt`.
  merged: () => search<MergedRow>('recently-merged', 'is:pr author:@me is:merged sort:updated-desc', 10, 'MergedRow', MERGED_ROW_FIELDS),
  mergedThisWeek: () =>
    queryOptions({
      queryKey: ['home', 'merged-this-week'],
      queryFn: async () =>
        (await gql<{ search: { issueCount: number } }>(`query Home($q: String!) { search(type: ISSUE, first: 0, query: $q) { issueCount } }`, {
          q: `is:pr author:@me is:merged merged:>=${weekAgo()}`,
        })).search.issueCount,
      staleTime: 30_000,
      persister: persisted,
    }),
};

export function prefetchHome(client: QueryClient) {
  client.prefetchQuery(homeQueries.reviewRequested());
  client.prefetchQuery(homeQueries.authored());
  client.prefetchQuery(homeQueries.assigned());
  client.prefetchQuery(homeQueries.merged());
  client.prefetchQuery(homeQueries.mergedThisWeek());
}
