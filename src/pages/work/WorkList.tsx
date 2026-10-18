import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUpDownIcon, CheckmarkCircle02Icon, CircleDotIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { usePageHotkey } from '@/app/keyboard';
import { cx } from '@/lib/cx';
import type { Peek } from '@/lib/routes';
import { sidePanelItem, useStorageItem } from '@/lib/settings';
import { Button } from '@/ui/Button';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { repoLabelFor } from '@/ui/WorkRow';
import { IssueSplit } from './IssueSplit';
import { PrTable } from './PrTable';
import { qualifierOf, sortOf, SORTS, squash, withQualifier, workListQuery, workQueryOf, workStateCountQueries, type Qualifier, type Sort, type WorkType } from './queries';

/**
 * A searchable list of pull requests (`kind` 'pr': a table) or issues ('issue': a list beside the open issue).
 * The GitHub search query is the whole state: Open/Closed, the filters and the sort each rewrite one qualifier
 * of it, it can be typed directly, and it lives in `?q=` like GitHub's. `fallback` is the query for a bare URL;
 * `repo` ("owner/name") scopes the search without showing up in the query, as on GitHub. `peek` is the pull
 * request or issue open beside the list.
 */
export function WorkList({ kind, fallback, repo, peek }: { kind: WorkType; fallback: string; repo?: string; peek?: Peek }) {
  const [q, setQ] = useState(() => workQueryOf(new URL(location.href), fallback));
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

  const sidePanel = useStorageItem(sidePanelItem) ?? false;
  const list = useInfiniteQuery(workListQuery(q, repo));
  const counts = useQueries({ queries: workStateCountQueries(q, repo) });

  const items = list.data?.pages.flatMap((page) => page.results.nodes) ?? [];
  const repoLabel = repo ? 'none' : repoLabelFor(items);
  const author = qualifierOf(q, 'author');
  const label = qualifierOf(q, 'label');
  const state = qualifierOf(q, 'state').split(':')[1];
  const sort = sortOf(q);

  /** Applies a chip's pick; "Other…" (a bare `key:`) is left in the search box to finish typing. */
  const filter = (name: Qualifier) => (token: string) => {
    if (!token.endsWith(':')) return setQ(withQualifier(q, name, token));
    // Focus first: the controlled value then lands with the caret at its end.
    searchRef.current?.focus();
    setDraft(`${withQualifier(q, name, '')} ${token}`);
  };

  const footer = list.hasNextPage && (
    <div className="flex justify-center border-t border-line p-3">
      <Button size="sm" variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
        Load more
      </Button>
    </div>
  );

  return (
    <>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(squash(draft) || fallback);
        }}
      >
        <label className="flex h-8 min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 transition-colors focus-within:border-accent/60">
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
          {(['open', 'closed'] as const).map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setQ(withQualifier(q, 'state', `is:${s}`))}
              className={cx(
                'flex h-6 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12px] [&>svg]:size-3.5',
                state === s ? 'bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {s === 'open' ? <HugeiconsIcon icon={CircleDotIcon} /> : <HugeiconsIcon icon={CheckmarkCircle02Icon} />}
              {s === 'open' ? 'Open' : 'Closed'}
              <span className="text-subtle tabular-nums">{counts[i]?.data?.toLocaleString() ?? '–'}</span>
            </button>
          ))}
        </div>
        <Chip label="Author" value={author} options={suggestions('author', ['@me', ...items.flatMap((item) => (item.author ? [item.author.login] : []))], author)} onChange={filter('author')} />
        <Chip label="Label" value={label} options={suggestions('label', items.flatMap((item) => item.labels.nodes.map((l) => l.name)), label)} onChange={filter('label')} />
        {/* The pull request table sorts from its headers. */}
        {kind === 'issue' && (
          <Menu<Sort>
            value={sort}
            options={(Object.keys(SORTS) as Sort[]).map((value) => ({ value, label: SORTS[value] }))}
            onChange={(next) => setQ(withQualifier(q, 'sort', `sort:${next}`))}
            trigger={(open) => (
              <Button onClick={open} icon={<HugeiconsIcon icon={ArrowUpDownIcon} className="size-3.5 text-subtle" />}>
                {SORTS[sort]}
              </Button>
            )}
          />
        )}
      </form>

      {q !== fallback && (
        <div className="mt-2.5 flex items-center gap-2 px-1 text-[12.5px] text-muted">
          {list.data && <span>{list.data.pages[0]?.results.issueCount.toLocaleString()} results</span>}
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
      ) : items.length === 0 ? (
        <Panel className="mt-4 animate-enter">
          <Empty>Nothing matches.</Empty>
        </Panel>
      ) : kind === 'pr' ? (
        <PrTable items={items} q={q} onQuery={setQ} repoLabel={repoLabel} peek={sidePanel} open={peek} footer={footer} />
      ) : (
        <IssueSplit items={items} peek={peek} scoped={!!repo} byCreated={sort.startsWith('created')} footer={footer} />
      )}
    </>
  );
}

/** A filter over one qualifier of the search; `value` is that qualifier as written in it ('' when unset). */
function Chip({ label, value, options, onChange }: { label: string; value: string; options: MenuOption<string>[]; onChange: (token: string) => void }) {
  // A value typed into the search that isn't one of the chip's options still shows, as written.
  const display = value && (options.find((option) => option.value === value)?.label ?? value);
  return (
    <Menu<string>
      value={value}
      options={options}
      onChange={onChange}
      align="left"
      trigger={(open) => (
        <Button onClick={open}>
          <span className={display ? 'font-normal text-muted' : undefined}>{label}</span>
          {display}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-subtle" />
        </Button>
      )}
    />
  );
}

/**
 * Options for a free-form qualifier (`author:`, `label:`): any, the values in the current results plus the
 * one in use, and "Other…", whose value is the bare `key:` for typing one into the search.
 */
function suggestions(key: string, values: string[], current: string): MenuOption<string>[] {
  const tokens = new Set(values.map((value) => `${key}:${/\s/.test(value) ? `"${value}"` : value}`));
  if (current) tokens.add(current);
  return [
    { value: '', label: 'Any' },
    ...[...tokens].map((token) => ({ value: token, label: token.slice(key.length + 1).replace(/^"|"$/g, '') })),
    { value: `${key}:`, label: 'Other…', hint: `Type ${key}:name in the search` },
  ];
}
