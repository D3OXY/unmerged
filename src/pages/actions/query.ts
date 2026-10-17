import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { rest, restText } from '@/github/client';
import { persisted } from '@/lib/persist';
import { runOutcome } from '@/pages/pr/checks';

type User = { login: string; avatar_url: string };

/** A workflow run, as REST returns it (only the fields the page uses). */
export type WorkflowRun = {
  id: number;
  name: string;
  display_title: string;
  run_number: number;
  run_attempt: number;
  event: string;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string;
  created_at: string;
  run_started_at: string;
  updated_at: string;
  actor: User | null;
  triggering_actor: User | null;
  repository: { id: number };
  head_repository: { id: number; full_name: string } | null;
  /** Includes pull requests in other repos that share the head branch; `base.repo` tells them apart. */
  pull_requests: { number: number; base: { repo: { id: number } } }[];
};

export type Step = { number: number; name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null };

/** A job, as REST returns it (only the fields the page uses). */
export type Job = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  runner_name: string | null;
  steps?: Step[];
};

/** A run, job or step's status in the four states the UI draws (REST statuses are lowercase). */
export const outcome = ({ status, conclusion }: { status: string; conclusion: string | null }) =>
  runOutcome({ status: status.toUpperCase(), conclusion: conclusion?.toUpperCase() ?? null });

/** "42s", "2m 16s", "1h 3m" from `from` to `to`, or to now while it's still going. */
export function elapsed(from: string, to?: string | null) {
  const seconds = Math.max(0, Math.round(((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const key = (owner: string, repo: string) => [owner.toLowerCase(), repo.toLowerCase()] as const;
const runPath = (owner: string, repo: string, runId: number, attempt?: number) =>
  `/repos/${owner}/${repo}/actions/runs/${runId}${attempt ? `/attempts/${attempt}` : ''}`;

/** A run, at its latest attempt or at `attempt`. The page polls it (and its jobs) while it's unfinished. */
export const runQuery = (owner: string, repo: string, runId: number, attempt?: number) =>
  queryOptions({
    queryKey: ['run', ...key(owner, repo), runId, attempt ?? null],
    queryFn: ({ signal }) => rest<WorkflowRun>(runPath(owner, repo, runId, attempt), { signal }),
    persister: persisted,
  });

// GitHub takes about a second plus 0.15 s per job (their steps) to answer, and a page of 100 big jobs can
// time out, so jobs come in small pages, all but the first in parallel.
const JOBS_PAGE = 20;

/** Every job in a run's latest attempt (or `attempt`), in the order GitHub lists them (at most 500). */
export const runJobsQuery = (owner: string, repo: string, runId: number, attempt?: number) =>
  queryOptions({
    queryKey: ['run-jobs', ...key(owner, repo), runId, attempt ?? null],
    queryFn: async ({ signal }) => {
      const page = (n: number) => rest<{ total_count: number; jobs: Job[] }>(`${runPath(owner, repo, runId, attempt)}/jobs?per_page=${JOBS_PAGE}&page=${n}`, { signal });
      const first = await page(1);
      const pages = Math.min(Math.ceil(first.total_count / JOBS_PAGE), 500 / JOBS_PAGE);
      const others = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page(i + 2)));
      return [first, ...others].flatMap((batch) => batch.jobs);
    },
    persister: persisted,
  });

/**
 * The pull request whose head is `head` ("user:branch"). A run's `pull_requests` leaves out pull requests from
 * forks, so this finds them.
 */
export const headPrQuery = (owner: string, repo: string, head: string) =>
  queryOptions({
    queryKey: ['head-pr', ...key(owner, repo), head],
    queryFn: async ({ signal }) => {
      const [pr] = await rest<{ number: number }[]>(`/repos/${owner}/${repo}/pulls?state=all&per_page=1&head=${encodeURIComponent(head)}`, { signal });
      return pr?.number ?? null;
    },
    staleTime: Infinity,
    persister: persisted,
  });

/** One job with its steps, polled until it finishes. */
export const jobQuery = (owner: string, repo: string, jobId: number) =>
  queryOptions({
    queryKey: ['job', ...key(owner, repo), jobId],
    queryFn: ({ signal }) => rest<Job>(`/repos/${owner}/${repo}/actions/jobs/${jobId}`, { signal }),
    refetchInterval: (query) => (query.state.data && query.state.data.status !== 'completed' ? 10_000 : false),
    persister: persisted,
  });

/**
 * A finished job's whole log, or null when GitHub has none (expired, or not uploaded yet). Not persisted: logs
 * run to megabytes. A log never changes once it's there; a missing one is asked for again next time.
 */
export const jobLogQuery = (owner: string, repo: string, jobId: number) =>
  queryOptions({
    queryKey: ['job-log', ...key(owner, repo), jobId],
    queryFn: ({ signal }) => restText(`/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, signal),
    staleTime: (query) => (query.state.data === null ? 0 : Infinity),
  });

/** What a run URL will show, started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchRun(client: QueryClient, owner: string, repo: string, runId: number, attempt?: number, job?: number) {
  client.prefetchQuery(runQuery(owner, repo, runId, attempt));
  client.prefetchQuery(runJobsQuery(owner, repo, runId, attempt));
  if (job === undefined) return;
  // A running job has no log yet; asking would only cache the 404.
  client
    .fetchQuery(jobQuery(owner, repo, job))
    .then((data) => {
      if (data.status === 'completed') client.prefetchQuery(jobLogQuery(owner, repo, job));
    })
    .catch(() => {});
}
