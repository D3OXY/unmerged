import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Clock01Icon, GitBranchIcon, GitCommitHorizontalIcon, GitPullRequestIcon, UndoIcon } from '@hugeicons/core-free-icons';
import { rest } from '@/github/client';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { fullDate, timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import type { CheckOutcome } from '@/pages/pr/checks';
import { OutcomeIcon } from '@/pages/pr/ChecksTab';
import { RepoFrame } from '@/pages/repo/RepoFrame';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Avatar, Empty, Panel, SectionHeader, Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import { JobView } from './JobView';
import { capitalize, elapsed, headPrQuery, outcome, runJobsQuery, runQuery, type Job, type WorkflowRun } from './query';

type Props = { owner: string; repo: string; runId: number; attempt?: number; job?: number };

/**
 * A workflow run under the repo header: what triggered it, how it went, and its jobs. With `job`, that job's
 * steps and logs sit next to the run's jobs. Polls while the run is unfinished, and after a re-run until
 * GitHub starts the new attempt.
 */
export function RunPage({ owner, repo, runId, attempt, job }: Props) {
  const [rerunOf, setRerunOf] = useState<number>();
  const live = (data?: WorkflowRun) => !!data && (data.status !== 'completed' || data.run_attempt === rerunOf);
  const { data: run, error } = useQuery({ ...runQuery(owner, repo, runId, attempt), refetchInterval: (query) => (live(query.state.data) ? 10_000 : false) });
  const jobs = useQuery({ ...runJobsQuery(owner, repo, runId, attempt), refetchInterval: live(run) ? 15_000 : false });
  const base = `/${owner}/${repo}/actions/runs/${runId}`;
  useTitle(run && `${run.display_title} · ${run.name} #${run.run_number} · ${owner}/${repo}`);

  return (
    <RepoFrame owner={owner} name={repo} view="actions" item={run ? `${run.name} #${run.run_number}` : 'Run'}>
      {error ? (
        <Panel className="p-8 text-[13px]">
          <p className="text-danger">{error.message}</p>
          <Button className="mt-4" onClick={openClassic}>
            Open in classic GitHub
          </Button>
        </Panel>
      ) : (
        <>
          {run ? <RunHeader run={run} owner={owner} repo={repo} base={base} attempt={attempt} onRerun={() => setRerunOf(run.run_attempt)} /> : <HeaderSkeleton />}
          {job === undefined ? (
            <JobList jobs={jobs.data} base={base} error={jobs.error} />
          ) : (
            <div className="grid items-start gap-6 @4xl:grid-cols-[260px_minmax(0,1fr)]">
              <JobNav jobs={jobs.data} base={base} selected={job} />
              <JobView owner={owner} repo={repo} jobId={job} />
            </div>
          )}
        </>
      )}
    </RepoFrame>
  );
}

const TONE: Record<CheckOutcome, string> = {
  SUCCESS: 'text-success bg-success/10 border-success/25',
  FAILURE: 'text-danger bg-danger/10 border-danger/25',
  PENDING: 'text-warning bg-warning/10 border-warning/25',
  NEUTRAL: 'text-muted bg-hover border-line',
};

function RunHeader({ run, owner, repo, base, attempt, onRerun }: { run: WorkflowRun; owner: string; repo: string; base: string; attempt?: number; onRerun: () => void }) {
  const queryClient = useQueryClient();
  const nwo = `${owner}/${repo}`;
  const result = outcome(run);
  // Pull requests from other repos can share the head branch name; only this repo's is the run's.
  const ownPr = run.pull_requests.find((p) => p.base.repo.id === run.repository.id)?.number;
  const fork = run.head_repository && run.head_repository.id !== run.repository.id ? run.head_repository.full_name : null;
  const forkHead = fork && run.head_branch && run.event.startsWith('pull_request') ? `${fork.split('/')[0]}:${run.head_branch}` : null;
  const forkPr = useQuery({ ...headPrQuery(owner, repo, forkHead ?? ''), enabled: !!forkHead && !ownPr }).data;
  const pr = ownPr ?? forkPr;
  const actor = run.triggering_actor ?? run.actor;
  // How many attempts there are; an older attempt's page only knows its own number.
  const latest = useQuery({ ...runQuery(owner, repo, run.id), enabled: attempt !== undefined }).data?.run_attempt ?? run.run_attempt;

  const rerun = useMutation({
    mutationFn: () => rest(`/repos/${nwo}/actions/runs/${run.id}/rerun-failed-jobs`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(`Re-running failed jobs in ${run.name}`);
      onRerun();
      return queryClient.invalidateQueries({ queryKey: runQuery(owner, repo, run.id).queryKey });
    },
    onError: toast.error,
  });

  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        <h1 data-private="commits" className="min-w-0 flex-1 text-[20px] leading-snug font-semibold tracking-tight break-words">
          {run.display_title}
        </h1>
        {attempt === undefined && run.status === 'completed' && result === 'FAILURE' && (
          <Button size="sm" loading={rerun.isPending} icon={<HugeiconsIcon icon={UndoIcon} className="size-3.5" />} onClick={() => rerun.mutate()}>
            Re-run failed jobs
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-subtle">
        <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium', TONE[result])}>
          <OutcomeIcon outcome={result} />
          {capitalize(run.conclusion ?? run.status)}
        </span>
        <span className="text-muted">
          {run.name} #{run.run_number}
        </span>
        <span>{run.event.replace(/_/g, ' ')}</span>
        {actor && (
          <span className="flex items-center gap-1.5">
            <Avatar src={actor.avatar_url} size={18} />
            <a href={`/${actor.login}`} className="text-muted hover:text-fg">
              {actor.login}
            </a>
            <span title={fullDate(run.created_at)}>{timeAgo(run.created_at)}</span>
          </span>
        )}
        {run.head_branch && (
          <a
            href={`/${fork ?? nwo}/tree/${run.head_branch}`}
            className="flex max-w-72 items-center gap-1 font-mono text-[11.5px] text-muted hover:text-fg"
          >
            <HugeiconsIcon icon={GitBranchIcon} className="size-3.5 shrink-0" />
            <span className="truncate">{forkHead ?? run.head_branch}</span>
          </a>
        )}
        {pr && (
          <a href={`/${nwo}/pull/${pr}`} className="flex items-center gap-1 text-muted hover:text-fg">
            <HugeiconsIcon icon={GitPullRequestIcon} className="size-3.5" />#{pr}
          </a>
        )}
        <a href={`/${nwo}/commit/${run.head_sha}`} className="flex items-center gap-1 font-mono text-[11.5px] text-muted hover:text-fg">
          <HugeiconsIcon icon={GitCommitHorizontalIcon} className="size-3.5" />
          {run.head_sha.slice(0, 7)}
        </a>
        <span className="flex items-center gap-1 tabular-nums" title={run.status === 'completed' ? 'Total duration' : 'Running for'}>
          <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
          {elapsed(run.run_started_at, run.status === 'completed' ? run.updated_at : null)}
        </span>
        {latest > 1 && (
          <Menu
            value={String(run.run_attempt)}
            options={Array.from({ length: latest }, (_, i) => ({ value: String(latest - i), label: `Attempt #${latest - i}`, hint: i === 0 ? 'Latest' : undefined }))}
            onChange={(n) => navigate(Number(n) === latest ? base : `${base}/attempts/${n}`)}
            trigger={(open) => (
              <button type="button" onClick={open} className="flex cursor-pointer items-center gap-1 text-muted hover:text-fg">
                Attempt #{run.run_attempt}
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
              </button>
            )}
          />
        )}
      </div>
    </div>
  );
}

/** The step a failed job failed at, as GitHub names it. */
const failedStep = (job: Job) => job.steps?.find((step) => step.conclusion === 'failure')?.name;

/** The run page's body: every job, linking to its logs. */
function JobList({ jobs, base, error }: { jobs?: Job[]; base: string; error: Error | null }) {
  if (error) return <p className="text-[13px] text-danger">{error.message}</p>;
  if (!jobs) return <Skeleton className="h-64 rounded-xl" />;
  const failed = jobs.filter((job) => outcome(job) === 'FAILURE').length;
  return (
    <section>
      <SectionHeader title="Jobs" count={jobs.length} action={failed > 0 && <span className="text-[12px] text-danger">{failed} failed</span>} />
      <Panel className="p-1.5">
        {jobs.length === 0 && <Empty>No jobs yet.</Empty>}
        {jobs.map((job) => {
          const result = outcome(job);
          const step = result === 'FAILURE' && failedStep(job);
          return (
            <a key={job.id} href={`${base}/job/${job.id}`} data-row className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-hover focus:bg-hover focus:outline-none">
              <OutcomeIcon outcome={result} />
              <span className="min-w-0 flex-1">
                <span className={cx('block truncate text-[12.5px]', result === 'FAILURE' ? 'font-medium text-fg' : 'text-fg/85')}>{job.name}</span>
                {step && <span className="block truncate text-[11.5px] text-subtle">Failed at {step}</span>}
              </span>
              <span className="text-[11.5px] text-subtle tabular-nums">
                {job.started_at && job.conclusion !== 'skipped' ? elapsed(job.started_at, job.completed_at) : job.conclusion === 'skipped' ? 'Skipped' : ''}
              </span>
            </a>
          );
        })}
      </Panel>
    </section>
  );
}

/** A job page's list of the run's jobs, beside the job, with a way back to the run. */
function JobNav({ jobs, base, selected }: { jobs?: Job[]; base: string; selected: number }) {
  const row = 'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] focus:outline-none';
  return (
    <Panel className="p-1.5 @4xl:sticky @4xl:top-[108px] @4xl:max-h-[calc(100vh-128px)] @4xl:overflow-y-auto">
      <a href={base} className={cx(row, 'text-muted hover:bg-hover hover:text-fg')}>
        Summary
      </a>
      <div className="mx-2.5 my-1 border-t border-line" />
      {jobs ? (
        jobs.map((job) => (
          <a
            key={job.id}
            href={`${base}/job/${job.id}`}
            data-row
            className={cx(row, job.id === selected ? 'bg-hover font-medium text-fg' : 'text-fg/85 hover:bg-hover focus:bg-hover')}
          >
            <OutcomeIcon outcome={outcome(job)} />
            <span className="min-w-0 flex-1 truncate">{job.name}</span>
          </a>
        ))
      ) : (
        <Skeleton className="mx-1 my-1 h-40" />
      )}
    </Panel>
  );
}

function HeaderSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-7 w-[520px] max-w-full" />
      <Skeleton className="mt-4 h-5 w-[380px] max-w-full" />
    </div>
  );
}
