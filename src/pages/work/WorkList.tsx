import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDownUp, CircleCheck, CircleDot, Search } from 'lucide-react';
import { gql } from '@/github/client';
import { usePageHotkey } from '@/app/keyboard';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { ISSUE_ROW_FIELDS, PR_ROW_FIELDS, WorkRow, type IssueRowData, type PrRowData } from '@/ui/WorkRow';

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
type ListPage = {
  results: { issueCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Item[] };
  open?: { issueCount: number };
  closed?: { issueCount: number };
};

const SORTS = {
  'updated-desc': 'Recently updated',
  'created-desc': 'Newest',
  'created-asc': 'Oldest',
  'comments-desc': 'Most commented',
} as const;
type Sort = keyof typeof SORTS;

// GitHub's newer pages write `state:open`; both mean the same.
const STATE = /(^|\s)(?:is|state):(open|closed|merged)(?=\s|$)/g;
const SORT = /(^|\s)sort:\S+/g;
const squash = (q: string) => q.replace(/\s+/g, ' ').trim();

/** The query with its state qualifier set: first, where GitHub puts it. */
const withState = (q: string, state: 'open' | 'closed') => squash(`is:${state} ${q.replace(STATE, ' ')}`);
const withSort = (q: string, sort: Sort) => squash(`${q.replace(SORT, ' ')} sort:${sort}`);
const isSort = (value: string | undefined): value is Sort => value !== undefined && Object.hasOwn(SORTS, value);
// Search without a sort qualifier returns newest first.
const sortOf = (q: string): Sort => {
  const sort = q.match(/(?:^|\s)sort:(\S+)/)?.[1];
  return isSort(sort) ? sort : 'created-desc';
};

/**
 * A searchable list of pull requests or issues. The GitHub search query is the whole state: Open/Closed and
 * Sort edit it, it can be typed directly, and it lives in `?q=` like GitHub's. `fallback` is the query for a
 * bare URL; `repo` ("owner/name") scopes the search without showing up in the query, as on GitHub.
 */
export function WorkList({ fallback, repo }: { fallback: string; repo?: string }) {
  const [q, setQ] = useState(() => new URL(location.href).searchParams.get('q') || fallback);
  const [draft, setDraft] = useState(q);
  const searchRef = useRef<HTMLInputElement>(null);

  usePageHotkey('/', useCallback(() => searchRef.current?.focus(), []));

  useEffect(() => {
    setDraft(q);
    const url = new URL(location.href);
    if (q === fallback) url.searchParams.delete('q');
    else url.searchParams.set('q', q);
    history.replaceState(history.state, '', url);
  }, [q, fallback]);

  const scoped = (query: string) => (repo ? `${query} repo:${repo}` : query);
  const list = useInfiniteQuery({
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
  });

  const first = list.data?.pages[0];
  const items = list.data?.pages.flatMap((page) => page.results.nodes) ?? [];
  const state = q.match(/(?:^|\s)(?:is|state):(open|closed)(?=\s|$)/)?.[1];
  const sort = sortOf(q);

  return (
    <>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(squash(draft) || fallback);
        }}
      >
        <label className="flex h-8 min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 transition-colors focus-within:border-accent/60">
          <Search className="size-3.5 shrink-0 text-subtle" />
          <input
            ref={searchRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setDraft(q), e.currentTarget.blur())}
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-subtle"
            placeholder="GitHub search, e.g. is:open is:pr author:@me"
          />
          {draft === q ? <Kbd>/</Kbd> : <Kbd>↵</Kbd>}
        </label>
        <div className="flex rounded-lg border border-line bg-panel p-0.5">
          {(['open', 'closed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQ(withState(q, s))}
              className={cx(
                'flex h-6 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12px] [&>svg]:size-3.5',
                state === s ? 'bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {s === 'open' ? <CircleDot /> : <CircleCheck />}
              {s === 'open' ? 'Open' : 'Closed'}
              <span className="text-subtle tabular-nums">{first?.[s]?.issueCount.toLocaleString() ?? '–'}</span>
            </button>
          ))}
        </div>
        <Menu<Sort>
          value={sort}
          options={(Object.keys(SORTS) as Sort[]).map((value) => ({ value, label: SORTS[value] }))}
          onChange={(next) => setQ(withSort(q, next))}
          trigger={(open) => (
            <Button onClick={open} icon={<ArrowDownUp className="size-3.5 text-subtle" />}>
              {SORTS[sort]}
            </Button>
          )}
        />
      </form>

      {q !== fallback && (
        <div className="mt-3 flex items-center gap-2 px-1 text-[12.5px] text-muted">
          {first && <span>{first.results.issueCount.toLocaleString()} results</span>}
          <button type="button" onClick={() => setQ(fallback)} className="cursor-pointer text-subtle hover:text-fg">
            Reset search
          </button>
        </div>
      )}

      {list.error ? (
        <p className="py-10 text-[13px] text-danger">{list.error.message}</p>
      ) : list.isPending ? (
        <Panel className="mt-4 flex flex-col gap-3 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </Panel>
      ) : (
        <Panel className="mt-4 animate-enter overflow-hidden">
          {items.length === 0 && <Empty>Nothing matches.</Empty>}
          {items.map((item) =>
            item.__typename === 'PullRequest' ? <WorkRow key={item.id} kind="pr" item={item} inRepo={!!repo} /> : <WorkRow key={item.id} kind="issue" item={item} inRepo={!!repo} />,
          )}
          {list.hasNextPage && (
            <div className="flex justify-center border-t border-line p-3">
              <Button size="sm" variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
