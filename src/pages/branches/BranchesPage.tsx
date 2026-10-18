import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Cancel01Icon, Copy01Icon, Delete02Icon, GitBranchIcon, GitPullRequestCreateIcon, PlusSignIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { usePageHotkey } from '@/app/keyboard';
import { gql } from '@/github/client';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import type { BranchesTab } from '@/lib/routes';
import { sessionLogin } from '@/lib/session';
import { formatCount, fullDate, timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { compareHref } from '@/pages/compare/query';
import { RepoFrame, useRepo } from '@/pages/repo/RepoFrame';
import { canPushWith, repoQuery, type Repo } from '@/pages/repo/query';
import { treeUrl } from '@/pages/repo/urls';
import { Button } from '@/ui/Button';
import { checkCounts } from '@/ui/CommitList';
import { Modal } from '@/ui/Modal';
import { Avatar, Empty, Kbd, Panel, Pill, SectionHeader, Skeleton } from '@/ui/primitives';
import { CheckIcon, PrStateIcon } from '@/ui/status';
import { toast } from '@/ui/toast';
import {
  BRANCH_MUTATIONS,
  branchDetailsQuery,
  branchesKey,
  branchIndexQuery,
  branchLists,
  DETAILS_BATCH,
  indexProgress,
  resolveSource,
  type Branch,
  type BranchEntry,
} from './query';

const TABS: { tab: BranchesTab; label: string }[] = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'yours', label: 'Yours' },
  { tab: 'active', label: 'Active' },
  { tab: 'stale', label: 'Stale' },
  { tab: 'all', label: 'All' },
];

/** How many branches an overview section shows before "View more branches". */
const OVERVIEW_ROWS = 5;

/** What every row needs from the page: the repo and whether the viewer may change its branches. */
type Context = { owner: string; name: string; nwo: string; repo: Repo; canPush: boolean };

type Lists = ReturnType<typeof branchLists>;

const hrefFor = (nwo: string, tab: BranchesTab, query = '') => `/${nwo}/branches${tab === 'overview' ? '' : `/${tab}`}${query ? `?query=${encodeURIComponent(query)}` : ''}`;

/**
 * A repo's branches like GitHub's /branches: an overview (default, yours, active, stale) and a list per kind, each
 * row with its last commit, checks, distance from the default branch and pull request. `?query=` filters names.
 * Every branch is indexed first (GitHub can't sort them by date); the rows on screen then fill in their details.
 */
export function BranchesPage({ owner, repo: name, tab }: { owner: string; repo: string; tab: BranchesTab }) {
  const repo = useRepo(owner, name).data?.repository;
  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  useTitle(`Branches · ${nwo}`);

  const [query, setQuery] = useState(() => new URL(location.href).searchParams.get('query') ?? '');
  const search = query.trim();
  const q = search.toLowerCase();
  useEffect(() => {
    const url = new URL(location.href);
    if (search) url.searchParams.set('query', search);
    else url.searchParams.delete('query');
    history.replaceState(history.state, '', url);
  }, [search]);
  const searchRef = useRef<HTMLInputElement>(null);
  usePageHotkey('/', useCallback(() => searchRef.current?.focus(), []), 'Search branches');
  const [creating, setCreating] = useState(false);

  const index = useQuery(branchIndexQuery(owner, name));
  const progress = indexProgress.use()[`${owner}/${name}`.toLowerCase()];

  const defaultBranch = repo?.defaultBranchRef?.name;
  const login = sessionLogin();
  const lists = useMemo(() => {
    const entries = index.data?.entries ?? [];
    return branchLists(q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries, defaultBranch, login);
  }, [index.data, q, defaultBranch, login]);

  const ctx: Context | null = repo ? { owner, name, nwo, repo, canPush: canPushWith(repo.viewerPermission) } : null;
  // A search on the overview lists every match, as GitHub's does.
  const view = q && tab === 'overview' ? 'all' : tab;

  return (
    <RepoFrame owner={owner} name={name} view="branches">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <a
              key={t.tab}
              href={hrefFor(nwo, t.tab, search)}
              className={cx('flex h-8 items-center rounded-lg px-3 text-[13px] transition-colors', t.tab === tab ? 'bg-hover font-medium text-fg' : 'text-muted hover:text-fg')}
            >
              {t.label}
            </a>
          ))}
        </nav>
        <label className="ml-auto flex h-8 w-64 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] focus-within:border-line-strong">
          <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0 text-subtle" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              setQuery('');
              e.currentTarget.blur();
            }}
            placeholder="Search branches…"
            aria-label="Search branches"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="cursor-pointer text-subtle hover:text-fg">
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          ) : (
            <Kbd>/</Kbd>
          )}
        </label>
        {ctx?.canPush && !ctx.repo.isArchived && (
          <Button variant="primary" icon={<HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />} onClick={() => setCreating(true)}>
            New branch
          </Button>
        )}
      </div>

      {index.isPending && progress ? (
        <p className="mt-3 text-[12px] text-subtle tabular-nums">
          Listing branches… {progress.loaded.toLocaleString()} of {progress.total.toLocaleString()}
        </p>
      ) : (
        index.data &&
        index.data.entries.length < index.data.total && (
          <p className="mt-3 text-[12px] text-subtle">
            Sorted from the first {index.data.entries.length.toLocaleString()} of {index.data.total.toLocaleString()} branches GitHub lists (by name).
          </p>
        )
      )}

      <div className="mt-5 flex flex-col gap-6">
        {index.error ? (
          <p className="py-10 text-[13px] text-danger">{index.error.message}</p>
        ) : !ctx || index.isPending ? (
          <TableSkeleton />
        ) : view === 'overview' ? (
          <Overview ctx={ctx} lists={lists} />
        ) : (
          <BranchList key={view} ctx={ctx} tab={view} entries={lists[view]} search={search} />
        )}
      </div>

      {creating && ctx && <NewBranchDialog ctx={ctx} onClose={() => setCreating(false)} />}
    </RepoFrame>
  );
}

/** The default branch, then the first few of yours, active and stale, each linking to its full list. */
function Overview({ ctx, lists }: { ctx: Context; lists: Lists }) {
  const defaultEntry = lists.all.find((e) => e.name === ctx.repo.defaultBranchRef?.name);
  const sections = [
    { title: 'Your branches', tab: 'yours', entries: lists.yours },
    { title: 'Active branches', tab: 'active', entries: lists.active },
    { title: 'Stale branches', tab: 'stale', entries: lists.stale },
  ] as const;
  const shown = [...(defaultEntry ? [defaultEntry] : []), ...sections.flatMap((s) => s.entries.slice(0, OVERVIEW_ROWS))];
  const details = useBranchDetails(ctx, [...new Set(shown.map((e) => e.name))]);

  if (!lists.all.length) return <Message>This repository has no branches yet.</Message>;
  return (
    <>
      {defaultEntry && (
        <Section title="Default">
          <BranchTable ctx={ctx} entries={[defaultEntry]} details={details} />
        </Section>
      )}
      {sections.map(
        (s) =>
          !!s.entries.length && (
            <Section key={s.tab} title={s.title}>
              <BranchTable ctx={ctx} entries={s.entries.slice(0, OVERVIEW_ROWS)} details={details} more={s.entries.length > OVERVIEW_ROWS && hrefFor(ctx.nwo, s.tab)} />
            </Section>
          ),
      )}
    </>
  );
}

/** Yours, Active, Stale or All, twenty more at a time. */
function BranchList({ ctx, tab, entries, search }: { ctx: Context; tab: Exclude<BranchesTab, 'overview'>; entries: BranchEntry[]; search: string }) {
  const [limit, setLimit] = useState(DETAILS_BATCH);
  const shown = entries.slice(0, limit);
  const details = useBranchDetails(ctx, shown.map((e) => e.name));

  if (!entries.length) {
    const kind = tab === 'all' ? '' : tab === 'yours' ? 'of your ' : `${tab} `;
    return <Message>{search ? `No ${kind}branches match “${search}”.` : tab === 'yours' ? 'No branches with your latest commit.' : `No ${kind}branches.`}</Message>;
  }
  return (
    <div>
      <BranchTable ctx={ctx} entries={shown} details={details} />
      {entries.length > limit && (
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="ghost" onClick={() => setLimit((n) => n + DETAILS_BATCH)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

type Details = { rows: Record<string, Branch>; pending: boolean };

/**
 * The rows for `names` (in order), DETAILS_BATCH per request so a longer list only asks for its new branches.
 */
function useBranchDetails(ctx: Context, names: string[]): Details {
  const batches = Array.from({ length: Math.ceil(names.length / DETAILS_BATCH) }, (_, i) => names.slice(i * DETAILS_BATCH, (i + 1) * DETAILS_BATCH));
  return useQueries({
    queries: batches.map((batch) => branchDetailsQuery(ctx.owner, ctx.name, batch)),
    combine: (results) => ({ rows: Object.fromEntries(results.flatMap((r) => Object.entries(r.data ?? {}))), pending: results.some((r) => r.isPending) }),
  });
}

// Branch, updated, then (on wide panels) checks, behind | ahead and pull request, then delete.
const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_9rem_1.75rem] @3xl:grid-cols-[minmax(0,1fr)_9rem_5.5rem_8.5rem_5.5rem_1.75rem] items-center gap-x-4 px-4';
const WIDE = 'hidden @3xl:flex';

function BranchTable({ ctx, entries, details, more }: { ctx: Context; entries: BranchEntry[]; details: Details; more?: string | false }) {
  // Bars are drawn against the largest count in the table, as GitHub does.
  const scale = Math.max(1, ...entries.flatMap((e) => [details.rows[e.name]?.ahead ?? 0, details.rows[e.name]?.behind ?? 0]));
  return (
    <Panel className="@container overflow-hidden">
      <div className={cx(COLUMNS, 'h-9 border-b border-line text-[11.5px] font-medium text-subtle')}>
        <span>Branch</span>
        <span>Updated</span>
        <span className={WIDE}>Checks</span>
        <span className={cx(WIDE, 'justify-center')}>Behind | Ahead</span>
        <span className={WIDE}>Pull request</span>
        <span />
      </div>
      {entries.map((entry) => (
        <BranchRow key={entry.name} ctx={ctx} entry={entry} branch={details.rows[entry.name]} pending={details.pending} scale={scale} />
      ))}
      {more && (
        <a href={more} className="flex h-10 items-center justify-center gap-1 border-t border-line text-[12.5px] text-accent hover:bg-hover">
          View more branches
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </a>
      )}
    </Panel>
  );
}

/** One branch: name and last commit from the index; checks, behind | ahead and pull request once `branch` is in. */
function BranchRow({ ctx, entry, branch, pending, scale }: { ctx: Context; entry: BranchEntry; branch?: Branch; pending: boolean; scale: number }) {
  const queryClient = useQueryClient();
  const { nwo, repo } = ctx;
  const isDefault = entry.name === repo.defaultBranchRef?.name;
  const checks = branch?.rollup && checkCounts(branch.rollup);
  const filling = !branch && pending;

  const refresh = () => refreshBranches(queryClient, ctx);
  const remove = useMutation({
    mutationFn: (deleted: Branch) => gql(BRANCH_MUTATIONS.delete, { id: deleted.id }),
    onSuccess: (_, deleted) => {
      refresh();
      toast.success(`Deleted ${entry.name}`, {
        label: 'Restore',
        run: () =>
          gql(BRANCH_MUTATIONS.create, { repositoryId: repo.id, name: `refs/heads/${entry.name}`, oid: deleted.oid }).then(() => {
            toast.success(`Restored ${entry.name}`);
            refresh();
          }, toast.error),
      });
    },
    onError: toast.error,
  });

  return (
    <div className={cx(COLUMNS, 'h-12 border-b border-line text-[12.5px] last:border-b-0', remove.isPending && 'opacity-50')}>
      <span className="flex min-w-0 items-center gap-1.5">
        <a href={treeUrl(nwo, entry.name)} title={entry.name} className="truncate rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[12px] text-accent hover:underline">
          {entry.name}
        </a>
        <button type="button" onClick={() => copy(entry.name, 'branch name')} title="Copy branch name" className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
        </button>
      </span>

      <span className="flex min-w-0 items-center gap-2 text-muted" title={`${entry.author?.user?.login ?? entry.author?.name ?? 'Unknown'} · ${fullDate(entry.committedDate)}`}>
        <Avatar src={entry.author?.user?.avatarUrl} size={18} />
        <span className="truncate">{timeAgo(entry.committedDate)}</span>
      </span>

      <span className={cx(WIDE, 'items-center gap-1.5 text-muted tabular-nums')}>
        {filling ? (
          <Skeleton className="h-3.5 w-12" />
        ) : (
          checks &&
          checks.total > 0 && (
            <>
              <CheckIcon state={branch.rollup?.state} />
              {checks.passed} / {checks.total}
            </>
          )
        )}
      </span>

      <span className={cx(WIDE, 'justify-center')}>
        {isDefault ? (
          <Pill>Default</Pill>
        ) : filling ? (
          <Skeleton className="h-3.5 w-20" />
        ) : (
          branch && <AheadBehind ahead={branch.ahead} behind={branch.behind} scale={scale} base={repo.defaultBranchRef?.name ?? 'the default branch'} />
        )}
      </span>

      <span className={WIDE}>
        {isDefault ? null : filling ? (
          <Skeleton className="h-3.5 w-12" />
        ) : branch?.pr ? (
          <a href={`/${nwo}/pull/${branch.pr.number}`} className="inline-flex h-6 items-center gap-1 rounded-full border border-line px-2 text-[12px] text-muted tabular-nums hover:border-line-strong hover:text-fg">
            <PrStateIcon state={branch.pr.state} isDraft={branch.pr.isDraft} className="size-3.5" />#{branch.pr.number}
          </a>
        ) : (
          !!branch?.ahead && (
            <a href={compareHref(nwo, undefined, entry.name, true)} className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] text-subtle hover:bg-hover hover:text-fg">
              <HugeiconsIcon icon={GitPullRequestCreateIcon} className="size-3.5" />
              New
            </a>
          )
        )}
      </span>

      <span className="flex justify-end">
        {ctx.canPush && !isDefault && !repo.isArchived && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${entry.name}`}
            title={branch?.pr?.state === 'OPEN' ? 'Its pull request is still open' : 'Delete branch'}
            disabled={!branch || branch.pr?.state === 'OPEN'}
            loading={remove.isPending}
            icon={<HugeiconsIcon icon={Delete02Icon} className="size-3.5" />}
            onClick={() => branch && remove.mutate(branch)}
          />
        )}
      </span>
    </div>
  );
}

/** Commits behind the default branch (bar growing left) and ahead of it (growing right), scaled to the table. */
function AheadBehind({ ahead, behind, scale, base }: { ahead: number; behind: number; scale: number; base: string }) {
  const bar = (n: number) => ({ width: n ? `max(2px, ${(n / scale) * 100}%)` : 0 });
  return (
    <span className="grid w-full grid-cols-2 text-[11.5px] text-muted tabular-nums" title={`${behind.toLocaleString()} behind, ${ahead.toLocaleString()} ahead of ${base}`}>
      <span className="flex flex-col items-end gap-1 border-r border-line-strong pr-1.5">
        {formatCount(behind)}
        <span className="h-1 rounded-l-full bg-subtle/50" style={bar(behind)} />
      </span>
      <span className="flex flex-col items-start gap-1 pl-1.5">
        {formatCount(ahead)}
        <span className="h-1 rounded-r-full bg-subtle/50" style={bar(ahead)} />
      </span>
    </span>
  );
}

/** A new branch from any branch, tag or commit; the default branch unless changed. */
function NewBranchDialog({ ctx, onClose }: { ctx: Context; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { owner, name, nwo, repo } = ctx;
  const [branch, setBranch] = useState('');
  const [source, setSource] = useState(repo.defaultBranchRef?.name ?? '');
  const create = useMutation({
    mutationFn: async () => {
      const oid = await resolveSource(owner, name, source.trim());
      if (!oid) throw new Error(`There's no branch, tag or commit called ${source.trim()}.`);
      await gql(BRANCH_MUTATIONS.create, { repositoryId: repo.id, name: `refs/heads/${branch.trim()}`, oid });
    },
    onSuccess: () => {
      const created = branch.trim();
      refreshBranches(queryClient, ctx);
      toast.success(`Created ${created}`, { label: 'Open', run: () => navigate(treeUrl(nwo, created)) });
      onClose();
    },
    onError: toast.error,
  });

  return (
    <Modal label="New branch" onClose={onClose} className="w-[420px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (branch.trim() && source.trim()) create.mutate();
        }}
      >
        <header className="flex items-center px-4 pt-4 pb-3">
          <span className="flex flex-1 items-center gap-2 text-[14px] font-semibold tracking-tight">
            <HugeiconsIcon icon={GitBranchIcon} className="size-4 text-subtle" />
            New branch
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </header>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field label="Name">
            <input autoFocus value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="feature/my-change" className={FIELD} />
          </Field>
          <Field label="Source" hint="A branch, tag or commit">
            <input value={source} onChange={(e) => setSource(e.target.value)} className={FIELD} />
          </Field>
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!branch.trim() || !source.trim()} loading={create.isPending}>
            Create branch
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

const FIELD = 'h-8 rounded-lg border border-line bg-bg px-2.5 font-mono text-[12.5px] outline-none placeholder:text-subtle focus:border-accent/60';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[12px] font-medium text-muted">
        {label}
        {hint && <span className="font-normal text-subtle">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** After a branch is created, deleted or restored: every list here, the repo's branch count and the branch picker. */
function refreshBranches(queryClient: QueryClient, { owner, name }: Context) {
  queryClient.invalidateQueries({ queryKey: branchesKey(owner, name) });
  queryClient.invalidateQueries({ queryKey: repoQuery(owner, name).queryKey });
  queryClient.invalidateQueries({ queryKey: ['repo-refs', owner, name] });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <Panel>
      <Empty>{children}</Empty>
    </Panel>
  );
}

function TableSkeleton() {
  return (
    <Panel className="overflow-hidden">
      <div className="h-9 border-b border-line" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-4 border-b border-line px-4 last:border-b-0">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </Panel>
  );
}
