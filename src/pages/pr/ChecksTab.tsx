import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, ArrowUpRight01Icon, CancelCircleIcon, InformationCircleIcon, MinusSignIcon, StopCircleIcon, UndoIcon } from '@hugeicons/core-free-icons';
import { gql, rest } from '@/github/client';
import type { CheckState } from '@/github/types';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { Button } from '@/ui/Button';
import { Avatar, Empty, Panel, Pill, Skeleton } from '@/ui/primitives';
import { CheckIcon } from '@/ui/status';
import { toast } from '@/ui/toast';
import { ORDER, runOutcome, type CheckOutcome } from './checks';
import { repoPath, SLOW_POLL, type PullRequest } from './query';

/** What the Checks tab reads of the pull request: the first part has it. */
type ChecksPr = Pick<PullRequest, 'id' | 'number' | 'url' | 'headRefOid'>;

const CHECKS_QUERY = /* GraphQL */ `
  query PrChecks($id: ID!, $number: Int!) {
    node(id: $id) {
      ... on PullRequest {
        commits(last: 1) {
          nodes {
            commit {
              oid
              checkSuites(first: 50) {
                nodes {
                  id
                  app { name logoUrl }
                  workflowRun { databaseId runNumber event url workflow { name } }
                  checkRuns(first: 100) {
                    nodes {
                      id name status conclusion startedAt completedAt detailsUrl title summary
                      isRequired(pullRequestNumber: $number)
                    }
                  }
                }
              }
              status { contexts { id context state targetUrl description createdAt avatarUrl isRequired(pullRequestNumber: $number) } }
            }
          }
        }
      }
    }
  }
`;

const ANNOTATIONS_QUERY = /* GraphQL */ `
  query CheckRunAnnotations($id: ID!) {
    node(id: $id) {
      ... on CheckRun { annotations(first: 50) { nodes { path title message annotationLevel location { start { line } } } } }
    }
  }
`;

type Annotation = {
  path: string;
  title: string | null;
  message: string;
  annotationLevel: 'FAILURE' | 'WARNING' | 'NOTICE' | null;
  location: { start: { line: number } };
};

type CheckRun = {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  detailsUrl: string | null;
  title: string | null;
  summary: string | null;
  isRequired: boolean;
};

type Suite = {
  id: string;
  app: { name: string; logoUrl: string } | null;
  workflowRun: { databaseId: number; runNumber: number; event: string; url: string; workflow: { name: string } } | null;
  checkRuns: { nodes: CheckRun[] };
};

type StatusContext = {
  id: string;
  context: string;
  state: CheckState;
  targetUrl: string | null;
  description: string | null;
  avatarUrl: string | null;
  isRequired: boolean;
};

type ChecksData = {
  node: {
    commits: { nodes: { commit: { oid: string; checkSuites: { nodes: Suite[] }; status: { contexts: StatusContext[] } | null } }[] };
  };
};

function duration(run: CheckRun) {
  if (!run.startedAt) return null;
  const seconds = Math.round(((run.completedAt ? new Date(run.completedAt) : new Date()).getTime() - new Date(run.startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function OutcomeIcon({ outcome }: { outcome: CheckOutcome }) {
  if (outcome === 'NEUTRAL') return <HugeiconsIcon icon={MinusSignIcon} className="size-3.5 shrink-0 text-subtle" />;
  if (outcome === 'CANCELLED') return <HugeiconsIcon icon={StopCircleIcon} className="size-3.5 shrink-0 text-subtle" />;
  if (outcome === 'ACTION_REQUIRED') return <HugeiconsIcon icon={Alert02Icon} className="size-3.5 shrink-0 text-warning" />;
  return <CheckIcon state={outcome} />;
}

/**
 * True while a run on the PR's head commit is unfinished. After a push, the answer is for another commit:
 * then false, so the status poll takes over and sees the push.
 */
export const runsUnfinished = (data: ChecksData | undefined, headRefOid: string) => {
  const commit = data?.node.commits.nodes[0]?.commit;
  return commit?.oid === headRefOid && commit.checkSuites.nodes.some((s) => s.checkRuns.nodes.some((r) => r.status !== 'COMPLETED'));
};

/**
 * CI for the head commit: runs grouped by workflow on the left, the selected run's annotations on the right.
 * Polls while a run is unfinished, and throughout `watching` (just after a re-run, before GitHub queues it).
 * `onPolling` tells PrPage when this poll runs, so its status poll pauses. `slow`: PrPage has polled for two minutes.
 */
export function ChecksTab({ pr, watching, slow, onRerun, onPolling }: {
  pr: ChecksPr;
  watching: boolean;
  slow: boolean;
  onRerun: () => void;
  onPolling: (polling: boolean) => void;
}) {
  const polls = (data: ChecksData | undefined) => watching || runsUnfinished(data, pr.headRefOid);
  const { data, isPending, error } = useQuery({
    queryKey: ['pr-checks', pr.id, pr.headRefOid],
    queryFn: () => gql<ChecksData>(CHECKS_QUERY, { id: pr.id, number: pr.number }),
    refetchInterval: (query) => (polls(query.state.data) ? (slow ? SLOW_POLL : 15_000) : false),
  });
  const polling = polls(data);
  useEffect(() => {
    onPolling(polling);
    return () => onPolling(false);
  }, [polling, onPolling]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (error) return <p className="text-[13px] text-danger">{error.message}</p>;
  if (isPending) return <Skeleton className="h-80 rounded-xl" />;

  const commit = data.node.commits.nodes[0]?.commit;
  const suites = (commit?.checkSuites.nodes ?? [])
    .filter((s) => s.checkRuns.nodes.length)
    .map((s) => ({ ...s, runs: [...s.checkRuns.nodes].sort((a, b) => ORDER[runOutcome(a)] - ORDER[runOutcome(b)]) }))
    .sort((a, b) => ORDER[runOutcome(a.runs[0]!)] - ORDER[runOutcome(b.runs[0]!)]);
  const statuses = commit?.status?.contexts ?? [];
  const allRuns = suites.flatMap((s) => s.runs);

  if (!allRuns.length && !statuses.length) {
    return (
      <Panel>
        <Empty>No checks reported for the latest commit.</Empty>
      </Panel>
    );
  }

  const selected = allRuns.find((r) => r.id === selectedId) ?? allRuns[0];
  const selectedSuite = suites.find((s) => s.runs.includes(selected!));

  return (
    <div className="grid gap-6 @3xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        {suites.map((suite) => (
          <SuiteCard key={suite.id} suite={suite} runs={suite.runs} pr={pr} selectedId={selected?.id} onSelect={setSelectedId} onRerun={onRerun} />
        ))}
        {statuses.length > 0 && (
          <Panel className="p-1.5">
            <div className="px-2.5 py-1.5 text-[12px] font-medium text-muted">Commit statuses</div>
            {statuses.map((status) => (
              <a key={status.id} href={status.targetUrl ?? undefined} className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-hover">
                <CheckIcon state={status.state} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{status.context}</span>
                  {status.description && <span className="block truncate text-[11.5px] text-subtle">{status.description}</span>}
                </span>
                {status.isRequired && <Pill>Required</Pill>}
              </a>
            ))}
          </Panel>
        )}
      </div>
      {selected && <RunDetail run={selected} suite={selectedSuite} repoUrl={`/${repoPath(pr)}`} oid={commit!.oid} />}
    </div>
  );
}

function SuiteCard({
  suite,
  runs,
  pr,
  selectedId,
  onSelect,
  onRerun,
}: {
  suite: Suite;
  runs: CheckRun[];
  pr: ChecksPr;
  selectedId?: string;
  onSelect: (id: string) => void;
  onRerun: () => void;
}) {
  const queryClient = useQueryClient();
  // GitHub's "re-run failed jobs" also re-runs cancelled ones.
  const failed = runs.some((r) => ['FAILURE', 'CANCELLED'].includes(runOutcome(r)));
  const run = suite.workflowRun;
  const rerun = useMutation({
    mutationFn: () => rest(`/repos/${repoPath(pr)}/actions/runs/${run!.databaseId}/rerun-failed-jobs`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(`Re-running failed jobs in ${run!.workflow.name}`);
      onRerun();
      return queryClient.invalidateQueries({ queryKey: ['pr-checks', pr.id] });
    },
    onError: toast.error,
  });

  return (
    <Panel className="p-1.5">
      <div className="flex h-9 items-center gap-2.5 px-2.5">
        {suite.app && <Avatar src={suite.app.logoUrl} size={16} square />}
        {run ? (
          <a href={run.url} className="min-w-0 flex-1 truncate text-[12.5px] font-medium hover:underline">
            {run.workflow.name}
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{suite.app?.name ?? 'Checks'}</span>
        )}
        {run && <span className="text-[11.5px] text-subtle">#{run.runNumber} · {run.event.replace(/_/g, ' ')}</span>}
        {run && failed && (
          <Button size="sm" variant="ghost" loading={rerun.isPending} icon={<HugeiconsIcon icon={UndoIcon} className="size-3" />} onClick={() => rerun.mutate()}>
            Re-run failed
          </Button>
        )}
      </div>
      {runs.map((r) => (
        <button
          key={r.id}
          type="button"
          data-row
          onClick={() => onSelect(r.id)}
          className={cx(
            'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left focus:outline-none',
            r.id === selectedId ? 'bg-hover text-fg' : 'text-fg/85 hover:bg-hover focus:bg-hover',
          )}
        >
          <OutcomeIcon outcome={runOutcome(r)} />
          <span className={cx('min-w-0 flex-1 truncate text-[12.5px]', runOutcome(r) === 'FAILURE' && 'font-medium')}>{r.name}</span>
          {r.isRequired && <span className="text-[10.5px] font-medium tracking-wide text-subtle uppercase">Req</span>}
          <span className="w-14 text-right text-[11.5px] text-subtle tabular-nums">{duration(r)}</span>
        </button>
      ))}
    </Panel>
  );
}

const LEVEL = {
  FAILURE: { icon: <HugeiconsIcon icon={CancelCircleIcon} className="size-3.5 text-danger" />, tone: 'border-danger/30' },
  WARNING: { icon: <HugeiconsIcon icon={Alert02Icon} className="size-3.5 text-warning" />, tone: 'border-warning/30' },
  NOTICE: { icon: <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5 text-info" />, tone: 'border-info/30' },
};

function RunDetail({ run, suite, repoUrl, oid }: { run: CheckRun; suite?: Suite; repoUrl: string; oid: string }) {
  const outcome = runOutcome(run);
  // Only the selected run's annotations are fetched, again whenever its status moves on.
  const { data, isPending } = useQuery({
    queryKey: ['check-annotations', run.id, run.status],
    queryFn: () => gql<{ node: { annotations: { nodes: Annotation[] } } | null }>(ANNOTATIONS_QUERY, { id: run.id }),
    staleTime: Infinity,
  });
  const annotations = data?.node?.annotations.nodes ?? [];
  return (
    <Panel className="self-start overflow-hidden @3xl:sticky @3xl:top-[108px]">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <OutcomeIcon outcome={outcome} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{run.name}</div>
          <div className="text-[12px] text-muted">
            {suite?.workflowRun?.workflow.name ?? suite?.app?.name}
            {duration(run) && ` · ${outcome === 'PENDING' ? 'running for' : 'took'} ${duration(run)}`}
          </div>
        </div>
        {run.detailsUrl && (
          <Button size="sm" icon={<HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5" />} onClick={() => navigate(run.detailsUrl!)}>
            Logs
          </Button>
        )}
      </div>
      <div className="flex max-h-[calc(100vh-220px)] flex-col gap-4 overflow-y-auto px-5 py-4">
        {run.title && <div className="text-[13px] font-medium">{run.title}</div>}
        {run.summary && <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted">{run.summary}</p>}
        {annotations.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] font-medium text-muted">Annotations</div>
            {annotations.map((a, i) => {
              const level = LEVEL[a.annotationLevel ?? 'NOTICE'];
              return (
                <div key={i} className={cx('rounded-lg border bg-bg', level.tone)}>
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12px]">
                    {level.icon}
                    <a href={`${repoUrl}/blob/${oid}/${a.path}#L${a.location.start.line}`} className="truncate font-mono text-muted hover:text-fg">
                      {a.path}:{a.location.start.line}
                    </a>
                  </div>
                  {a.title && <div className="px-3 pt-2 text-[12.5px] font-medium">{a.title}</div>}
                  <pre className="overflow-x-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-fg/85">{a.message}</pre>
                </div>
              );
            })}
          </div>
        )}
        {!run.title && !run.summary && !annotations.length && !isPending && (
          <p className="text-[12.5px] text-subtle">
            {outcome === 'PENDING' ? 'This check is still running.' : 'No summary reported. Open the logs for details.'}
          </p>
        )}
      </div>
    </Panel>
  );
}
