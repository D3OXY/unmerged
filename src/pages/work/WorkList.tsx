import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpDownIcon, CheckmarkCircle02Icon, CircleDotIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { usePageHotkey } from '@/app/keyboard';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { WorkRow } from '@/ui/WorkRow';
import { squash, withState, workListQuery } from './queries';

const SORTS = {
  'updated-desc': 'Recently updated',
  'created-desc': 'Newest',
  'created-asc': 'Oldest',
  'comments-desc': 'Most commented',
} as const;
type Sort = keyof typeof SORTS;

const SORT = /(^|\s)sort:\S+/g;
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

  usePageHotkey('/', useCallback(() => searchRef.current?.focus(), []), 'Search');

  useEffect(() => {
    setDraft(q);
    const url = new URL(location.href);
    if (q === fallback) url.searchParams.delete('q');
    else url.searchParams.set('q', q);
    history.replaceState(history.state, '', url);
  }, [q, fallback]);

  const list = useInfiniteQuery(workListQuery(q, repo));

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
          <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0 text-subtle" />
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
              {s === 'open' ? <HugeiconsIcon icon={CircleDotIcon} /> : <HugeiconsIcon icon={CheckmarkCircle02Icon} />}
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
            <Button onClick={open} icon={<HugeiconsIcon icon={ArrowUpDownIcon} className="size-3.5 text-subtle" />}>
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
