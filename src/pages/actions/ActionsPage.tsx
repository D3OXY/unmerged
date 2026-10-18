import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Cancel01Icon, FileCodeIcon, FilterIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { usePageHotkey } from '@/app/keyboard';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { fullDate, timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { OutcomeIcon } from '@/pages/pr/ChecksTab';
import { RepoFrame, useRepo } from '@/pages/repo/RepoFrame';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { capitalize, elapsed, outcome, parseRunQuery, runsQuery, setQualifier, workflowSegment, workflowsQuery, type RunSummary, type Workflow } from './query';

type Props = { owner: string; repo: string; workflow?: string };

// GitHub's own status filter, as `is:` values.
const STATUSES = [
  ['', 'All statuses'],
  ['success', 'Success'],
  ['failure', 'Failure'],
  ['in_progress', 'In progress'],
  ['queued', 'Queued'],
  ['waiting', 'Waiting'],
  ['action_required', 'Action required'],
  ['cancelled', 'Cancelled'],
  ['skipped', 'Skipped'],
] as const;

/**
 * A repo's workflow runs like GitHub's Actions page: every workflow's, or one workflow's, with the workflows in a
 * rail beside them. `?query=` filters with GitHub's qualifiers (is:, branch:, event:, actor:). Polls while a run
 * on screen is unfinished.
 */
export function ActionsPage({ owner, repo: name, workflow }: Props) {
  const repo = useRepo(owner, name).data?.repository;
  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  const workflows = useQuery(workflowsQuery(owner, name));
  const current = workflow ? workflows.data?.find((w) => workflowSegment(w).toLowerCase() === workflow.toLowerCase()) : undefined;
  const title = workflow && (current?.name ?? workflow);
  useTitle(`${title ? `${title} · ` : ''}Actions · ${nwo}`);

  const [query, setQuery] = useState(() => new URL(location.href).searchParams.get('query') ?? '');
  useEffect(() => {
    const url = new URL(location.href);
    if (query) url.searchParams.set('query', query);
    else url.searchParams.delete('query');
    history.replaceState(history.state, '', url);
  }, [query]);
  const { filter, unknown } = useMemo(() => parseRunQuery(query), [query]);
  const hrefFor = (segment?: string) => `/${nwo}/actions${segment ? `/workflows/${segment}` : ''}${query ? `?query=${encodeURIComponent(query)}` : ''}`;

  // The runs API takes a file name or an id; a dynamic workflow's URL segment is neither.
  const apiWorkflow = workflow?.includes('/') ? current?.id : workflow;
  const missing = !!workflow && !!workflows.data && !current;
  const runs = useInfiniteQuery({
    ...runsQuery(owner, name, apiWorkflow, filter),
    enabled: !unknown.length && (!workflow || apiWorkflow !== undefined),
    refetchInterval: (q) => (q.state.data?.pages.some((page) => page.runs.some((run) => run.status !== 'completed')) ? 15_000 : false),
  });
  // Pages are offsets, so a run that starts while you read shifts the next page by one; it's shown once.
  const rows = useMemo(() => [...new Map(runs.data?.pages.flatMap((page) => page.runs).map((run) => [run.id, run])).values()], [runs.data]);
  const total = runs.data?.pages[0]?.total;

  return (
    <RepoFrame owner={owner} name={name} view="actions" item={title}>
      <div className="grid items-start gap-6 @3xl:grid-cols-[220px_minmax(0,1fr)]">
        <WorkflowRail workflows={workflows.data} current={current} all={!workflow} hrefFor={hrefFor} />
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="min-w-0 truncate text-[17px] font-semibold tracking-tight">{title || 'All workflows'}</h2>
            {current?.path.startsWith('.github/') && repo?.defaultBranchRef && (
              <a
                href={`/${nwo}/blob/${repo.defaultBranchRef.name}/${current.path}`}
                className="flex items-center gap-1 font-mono text-[11.5px] text-muted hover:text-fg"
              >
                <HugeiconsIcon icon={FileCodeIcon} className="size-3.5" />
                {workflowSegment(current)}
              </a>
            )}
            {current && current.state !== 'active' && <span className="text-[12px] text-warning">Disabled</span>}
            {total !== undefined && (
              <span className="ml-auto text-[12.5px] text-subtle tabular-nums">
                {total.toLocaleString()} workflow {total === 1 ? 'run' : 'runs'}
              </span>
            )}
          </div>
          <Toolbar query={query} setQuery={setQuery} status={filter.status ?? ''} workflows={workflows.data} current={current} all={!workflow} hrefFor={hrefFor} />

          {unknown.length ? (
            <Message>
              Unmerged filters runs by is:, branch:, event: and actor:. It can't filter by “{unknown.join(' ')}”.
            </Message>
          ) : missing ? (
            <Message>This repository has no workflow “{workflow}”.</Message>
          ) : runs.error ?? workflows.error ? (
            <p className="py-10 text-[13px] text-danger">{(runs.error ?? workflows.error)?.message}</p>
          ) : runs.isPending ? (
            <ListSkeleton />
          ) : rows.length === 0 ? (
            <Message>
              {query ? 'No workflow runs match.' : 'No workflow runs yet.'}
              {query && (
                <button type="button" onClick={() => setQuery('')} className="ml-2 cursor-pointer text-muted hover:text-fg">
                  Clear filters
                </button>
              )}
            </Message>
          ) : (
            <div className="animate-enter">
              <Panel className="@container overflow-hidden">
                {rows.map((run) => (
                  <RunRow key={run.id} run={run} nwo={nwo} onBranch={(branch) => setQuery(setQualifier(query, 'branch', branch))} />
                ))}
              </Panel>
              {runs.hasNextPage && (
                <div className="mt-4 flex justify-center">
                  <Button size="sm" variant="ghost" loading={runs.isFetchingNextPage} onClick={() => runs.fetchNextPage()}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </RepoFrame>
  );
}

type Picker = { workflows?: Workflow[]; current?: Workflow; all: boolean; hrefFor: (segment?: string) => string };

/** All workflows and each one, beside the runs on wide panels. Links keep the filter. */
function WorkflowRail({ workflows, current, all, hrefFor }: Picker) {
  const row = 'flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12.5px] focus:outline-none';
  return (
    <nav aria-label="Workflows" className="hidden @3xl:sticky @3xl:top-[108px] @3xl:block @3xl:max-h-[calc(100vh-128px)] @3xl:overflow-y-auto">
      <a href={hrefFor()} data-row className={cx(row, all ? 'bg-hover font-medium text-fg' : 'text-muted hover:bg-hover hover:text-fg focus:bg-hover')}>
        All workflows
      </a>
      <div className="mx-2.5 my-1 border-t border-line" />
      {workflows ? (
        workflows.map((w) => (
          <a
            key={w.id}
            href={hrefFor(workflowSegment(w))}
            data-row
            title={w.path}
            className={cx(row, w.id === current?.id ? 'bg-hover font-medium text-fg' : 'text-fg/85 hover:bg-hover focus:bg-hover', w.state !== 'active' && 'text-subtle')}
          >
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            {w.state !== 'active' && <span className="text-[11px]">Disabled</span>}
          </a>
        ))
      ) : (
        <Skeleton className="mx-1 my-1 h-40" />
      )}
    </nav>
  );
}

/** The filter field (GitHub's query, applied on Enter), the status menu, and on narrow panels the workflow menu. */
function Toolbar({ query, setQuery, status, ...picker }: Picker & { query: string; setQuery: (query: string) => void; status: string }) {
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const inputRef = useRef<HTMLInputElement>(null);
  usePageHotkey('/', useCallback(() => inputRef.current?.focus(), []), 'Filter workflow runs');
  // A status typed into the field that the menu doesn't list shows as itself.
  const statuses = STATUSES.some(([value]) => value === status) ? STATUSES : [...STATUSES, [status, capitalize(status)] as const];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim().replace(/\s+/g, ' '));
        }}
        className="flex h-8 min-w-48 flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] focus-within:border-line-strong"
      >
        <HugeiconsIcon icon={FilterIcon} className="size-3.5 shrink-0 text-subtle" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            setDraft(query);
            e.currentTarget.blur();
          }}
          placeholder="Filter workflow runs: is:failure branch:main event:push actor:octocat"
          aria-label="Filter workflow runs"
          className="min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:font-sans placeholder:text-subtle"
        />
        {query ? (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear filters" className="cursor-pointer text-subtle hover:text-fg">
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        ) : (
          <Kbd>/</Kbd>
        )}
      </form>
      <div className="@3xl:hidden">
        <WorkflowMenu {...picker} />
      </div>
      <Menu<string>
        value={status}
        options={statuses.map(([value, label]) => ({ value, label }))}
        onChange={(value) => setQuery(setQualifier(query, 'is', value))}
        trigger={(open) => (
          <Button onClick={open}>
            {statuses.find(([value]) => value === status)?.[1]}
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-subtle" />
          </Button>
        )}
      />
    </div>
  );
}

/** The rail as a menu, for panels too narrow for it. */
function WorkflowMenu({ workflows = [], current, all, hrefFor }: Picker) {
  return (
    <Menu<string>
      value={all ? '' : current ? workflowSegment(current) : ''}
      options={[{ value: '', label: 'All workflows' }, ...workflows.map((w) => ({ value: workflowSegment(w), label: w.name, hint: w.state === 'active' ? undefined : 'Disabled' }))]}
      onChange={(segment) => navigate(hrefFor(segment || undefined))}
      align="left"
      trigger={(open) => (
        <Button onClick={open} icon={<HugeiconsIcon icon={PlayIcon} className="size-3.5 text-subtle" />}>
          {all ? 'All workflows' : (current?.name ?? 'Workflow')}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-subtle" />
        </Button>
      )}
    />
  );
}

/** What started a run, as GitHub's list says it: "Commit 1a2b3c4 pushed by octocat", "Scheduled"… */
function trigger(run: RunSummary) {
  const by = run.actor ? ` by ${run.actor}` : '';
  switch (run.event) {
    case 'push':
      return `Commit ${run.head_sha.slice(0, 7)} pushed${by}`;
    case 'pull_request':
    case 'pull_request_target':
      return `Pull request${run.pr ? ` #${run.pr}` : ''}${by}`;
    case 'schedule':
      return 'Scheduled';
    case 'workflow_dispatch':
      return `Manually run${by}`;
    default:
      return `${capitalize(run.event)}${by}`;
  }
}

/** One run: its outcome, title and trigger, its branch (a button that filters by it), when it ran and for how long. */
function RunRow({ run, nwo, onBranch }: { run: RunSummary; nwo: string; onBranch: (branch: string) => void }) {
  const done = run.status === 'completed';
  return (
    <div className="relative flex min-h-14 items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 focus-within:bg-hover hover:bg-hover">
      <OutcomeIcon outcome={outcome(run)} />
      <div className="min-w-0 flex-1">
        <a
          href={`/${nwo}/actions/runs/${run.id}`}
          data-row
          data-private="commits"
          className="block truncate text-[13px] font-medium text-fg after:absolute after:inset-0 focus:outline-none"
        >
          {run.display_title}
        </a>
        <span className="block truncate text-[11.5px] text-subtle">
          <span className="text-muted">
            {run.name} #{run.run_number}
          </span>
          {' · '}
          {trigger(run)}
        </span>
      </div>
      {run.head_branch && (
        <button
          type="button"
          onClick={() => onBranch(run.head_branch!)}
          title={`Show runs on ${run.head_branch}`}
          className="relative hidden max-w-48 cursor-pointer truncate rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[11.5px] text-accent hover:underline @xl:block"
        >
          {run.head_branch}
        </button>
      )}
      <span className="w-24 shrink-0 text-right text-[11.5px] leading-relaxed text-subtle tabular-nums">
        <span className="block" title={fullDate(run.created_at)}>
          {timeAgo(run.created_at)}
        </span>
        <span className="block">{done ? elapsed(run.run_started_at, run.updated_at) : run.status === 'in_progress' ? elapsed(run.run_started_at) : capitalize(run.status)}</span>
      </span>
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <Panel>
      <Empty>{children}</Empty>
    </Panel>
  );
}

function ListSkeleton() {
  return (
    <Panel className="overflow-hidden">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 border-b border-line px-4 last:border-b-0">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-4 w-72 max-w-[60%]" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </Panel>
  );
}
