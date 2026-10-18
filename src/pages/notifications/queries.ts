import { infiniteQueryOptions, keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { gql, restWithHeaders } from '@/github/client';
import type { IssueState, IssueStateReason, PrState } from '@/github/types';
import { persisted } from '@/lib/persist';

/** One thread from GET /notifications. */
export type Notification = {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  subject: { title: string; url: string | null; type: string };
  repository: { full_name: string; html_url: string; private: boolean; owner: { avatar_url: string } };
};

export type View = 'inbox' | 'unread' | 'participating';

/** What the page shows: a view (tab), optionally narrowed to one repository and one reason. */
export type Filters = { view: View; repo: string | null; reason: string | null };

/** One page of a list. Whether another follows is decided when it's fetched, so triage can't hide "Load more". */
export type Page = { items: Notification[]; hasMore: boolean };

const PARAMS: Record<View, string> = { inbox: 'all=true', unread: 'all=false', participating: 'all=true&participating=true' };
const VIEW_TERM: Record<View, string | null> = { inbox: null, unread: 'is:unread', participating: 'reason:participating' };
const PAGE_SIZE = 50;

/** The filters a notifications URL asks for, from GitHub's own `?query=` (`is:unread repo:owner/name reason:mention`). */
export function filtersOf(url: URL): Filters {
  const terms = (url.searchParams.get('query') ?? '').split(/\s+/);
  const value = (prefix: string) => terms.find((t) => t.startsWith(prefix) && t !== 'reason:participating')?.slice(prefix.length) || null;
  return {
    view: terms.includes('is:unread') ? 'unread' : terms.includes('reason:participating') ? 'participating' : 'inbox',
    repo: value('repo:')?.match(/^[\w-]+\/(?!\.+$)[\w.-]+$/)?.[0] ?? null,
    // GitHub writes reasons with dashes (`review-requested`); the API with underscores.
    reason: value('reason:')?.replace(/-/g, '_') ?? null,
  };
}

/** Which view (tab) a notifications URL asks for. */
export const viewOf = (url: URL) => filtersOf(url).view;

/** The `/notifications` URL for a set of filters, in GitHub's `?query=` syntax so links in and out mean the same. */
export function notificationsUrl({ view, repo, reason }: Filters) {
  const terms = [VIEW_TERM[view], repo && `repo:${repo}`, reason && `reason:${reason.replace(/_/g, '-')}`].filter(Boolean);
  return terms.length ? `/notifications?query=${encodeURIComponent(terms.join(' '))}` : '/notifications';
}

const hasNext = (headers: Headers) => /rel="next"/.test(headers.get('Link') ?? '');

async function fetchPage(view: View, page: number, signal: AbortSignal): Promise<Page> {
  const { data, headers } = await restWithHeaders<Notification[]>(`/notifications?${PARAMS[view]}&per_page=${PAGE_SIZE}&page=${page}`, { signal });
  return { items: data ?? [], hasMore: hasNext(headers) };
}

/**
 * A view's threads, 50 a page. It doesn't poll or refetch on focus itself: `unreadPollQuery` notices
 * changes cheaply, and the page refetches the list only when something did change.
 */
export const notificationsQuery = (view: View) =>
  infiniteQueryOptions({
    queryKey: ['notifications', 'list', view],
    queryFn: ({ pageParam, signal }) => fetchPage(view, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length + 1 : null),
    refetchOnWindowFocus: false,
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<Page>,
  });

type Poll = { unread: Notification[]; hasMore: boolean; lastModified: string | null; interval: number };

/**
 * Page 1 of unread threads, polled the way GitHub asks: conditionally (`If-Modified-Since`, a 304 is free
 * and means nothing changed) and no more often than `X-Poll-Interval`. Drives the unread badges, and a new
 * `lastModified` tells an open notifications page to refetch.
 */
export const unreadPollQuery = queryOptions({
  queryKey: ['notifications', 'poll'],
  queryFn: async ({ client, queryKey, signal }): Promise<Poll> => {
    const last = client.getQueryData<Poll>(queryKey);
    const { data, headers } = await restWithHeaders<Notification[]>(`/notifications?all=false&per_page=${PAGE_SIZE}`, {
      headers: last?.lastModified ? { 'If-Modified-Since': last.lastModified } : {},
      signal,
    });
    const interval = Number(headers.get('X-Poll-Interval')) || 60;
    if (last && !data) return { ...last, interval };
    return { unread: data ?? [], hasMore: hasNext(headers), lastModified: headers.get('Last-Modified'), interval };
  },
  refetchInterval: (query) => (query.state.data?.interval ?? 60) * 1000,
});

/** The unread badge ("12", "50+"), or null when there's nothing unread. Shared by the sidebar and palette. */
export function useUnreadCount() {
  const { data } = useQuery(unreadPollQuery);
  if (!data?.unread.length) return null;
  return `${data.unread.length}${data.hasMore ? '+' : ''}`;
}

export type SubjectState =
  | { __typename: 'PullRequest'; state: PrState; isDraft: boolean }
  | { __typename: 'Issue'; state: IssueState; stateReason: IssueStateReason | null };

/** "owner/repo#12" for a thread about an issue or pull request, from its subject's API URL. */
export function subjectRef({ subject }: Notification) {
  const match = subject.url?.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/(?:pulls|issues)\/(\d+)$/);
  return match ? `${match[1]}#${match[2]}` : null;
}

/**
 * Open / closed / merged / draft for every issue and PR in `refs` ("owner/repo#12"), in one GraphQL
 * request: one aliased `repository` per repo, one `issueOrPullRequest` per number.
 */
export const subjectStatesQuery = (refs: string[]) =>
  queryOptions({
    queryKey: ['notifications', 'states', refs],
    queryFn: async () => {
      const repos = [...Map.groupBy(refs, (ref) => ref.slice(0, ref.indexOf('#')))];
      const numbers = (repoRefs: string[]) => repoRefs.map((ref) => ref.slice(ref.indexOf('#') + 1));
      const fields = repos.map(([repo, repoRefs], i) => {
        const [owner, name] = repo.split('/');
        const subjects = numbers(repoRefs).map((n) => `n${n}: issueOrPullRequest(number: ${n}) { __typename ... on PullRequest { state isDraft } ... on Issue { state stateReason } }`);
        return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${subjects.join(' ')} }`;
      });
      // Partial: a deleted issue or a repo the token can't see resolves to null instead of failing the batch.
      const data = await gql<Record<string, Record<string, SubjectState | null> | null>>(`query SubjectStates { ${fields.join(' ')} }`, {}, true);
      const states: Record<string, SubjectState> = {};
      repos.forEach(([repo, repoRefs], i) => {
        for (const n of numbers(repoRefs)) {
          const state = data[`r${i}`]?.[`n${n}`];
          if (state) states[`${repo}#${n}`] = state;
        }
      });
      return states;
    },
    enabled: refs.length > 0,
    staleTime: 60_000,
    // Loading the next page asks again for every row; keep the icons already shown meanwhile.
    placeholderData: keepPreviousData,
  });
