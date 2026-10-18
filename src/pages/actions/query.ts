import { infiniteQueryOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
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

/** "in_progress" as "In progress": a REST status, conclusion or event for the UI. */
export const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).replace(/_/g, ' ');

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

/** A workflow, as REST returns it (only the fields the page uses). `state` is "active" or why it's off. */
export type Workflow = { id: number; name: string; path: string; state: string };

/**
 * A workflow's segment in GitHub's URLs (/actions/workflows/<segment>): its file name, or for a dynamic workflow
 * (path "dynamic/pages/pages-build-deployment") the path after "dynamic/".
 */
export const workflowSegment = ({ path }: Workflow) => (path.startsWith('.github/workflows/') ? path.slice('.github/workflows/'.length) : path.replace(/^dynamic\//, ''));

/** Every workflow in the repo (at most 100), sorted by name as GitHub's sidebar is. */
export const workflowsQuery = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ['workflows', ...key(owner, repo)],
    queryFn: async ({ signal }) => {
      const { workflows } = await rest<{ workflows: Workflow[] }>(`/repos/${owner}/${repo}/actions/workflows?per_page=100`, { signal });
      return workflows.map(({ id, name, path, state }) => ({ id, name, path, state })).sort((a, b) => a.name.localeCompare(b.name));
    },
    persister: persisted,
  });

/** What `?query=` filters runs by, under the runs API's parameter names. */
export type RunFilter = { status?: string; branch?: string; event?: string; actor?: string };

/** GitHub's qualifiers in `?query=` ("is:failure branch:main") and the API parameter each one sets. */
const QUALIFIERS: Record<string, keyof RunFilter | undefined> = { is: 'status', status: 'status', branch: 'branch', event: 'event', actor: 'actor' };

const paramOf = (word: string) => {
  const [, name, value] = /^(\w+):(.+)$/.exec(word) ?? [];
  return name && value ? { param: QUALIFIERS[name.toLowerCase()], value } : {};
};

/** Reads an Actions page's `?query=`. Words the runs API can't filter by come back in `unknown`. */
export function parseRunQuery(query: string) {
  const filter: RunFilter = {};
  const unknown: string[] = [];
  for (const word of query.split(/\s+/).filter(Boolean)) {
    const { param, value } = paramOf(word);
    if (param) filter[param] = value;
    else unknown.push(word);
  }
  return { filter, unknown };
}

/** `query` with its `name:` qualifier set to `value`, or without it when `value` is ''. */
export function setQualifier(query: string, name: 'is' | 'branch' | 'event' | 'actor', value: string) {
  const words = query.split(/\s+/).filter((word) => word && paramOf(word).param !== QUALIFIERS[name]);
  return [...words, ...(value ? [`${name}:${value}`] : [])].join(' ');
}

/** A run in the Actions list: what its row draws. The API's run is about 12 KB, mostly repository objects. */
export type RunSummary = ReturnType<typeof summarize>;

const summarize = (run: WorkflowRun) => ({
  id: run.id,
  name: run.name,
  display_title: run.display_title,
  run_number: run.run_number,
  event: run.event,
  status: run.status,
  conclusion: run.conclusion,
  head_branch: run.head_branch,
  head_sha: run.head_sha,
  created_at: run.created_at,
  run_started_at: run.run_started_at,
  updated_at: run.updated_at,
  actor: (run.triggering_actor ?? run.actor)?.login ?? null,
  // Pull requests from other repos can share the head branch name; only this repo's is the run's.
  pr: run.pull_requests.find((p) => p.base.repo.id === run.repository.id)?.number ?? null,
});

const RUNS_PAGE = 25;

/**
 * A repo's workflow runs, newest first, RUNS_PAGE at a time: every workflow's, or one workflow's (its file name
 * or id). GitHub counts at most 1,000 runs for a filtered list.
 */
export const runsQuery = (owner: string, repo: string, workflow: string | number | undefined, filter: RunFilter) =>
  infiniteQueryOptions({
    queryKey: ['runs', ...key(owner, repo), workflow ?? null, filter],
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ ...filter, per_page: String(RUNS_PAGE), page: String(pageParam) });
      const scope = workflow === undefined ? '' : `/workflows/${encodeURIComponent(workflow)}`;
      const page = await rest<{ total_count: number; workflow_runs: WorkflowRun[] }>(`/repos/${owner}/${repo}/actions${scope}/runs?${params}`, { signal });
      return { total: page.total_count, runs: page.workflow_runs.map(summarize) };
    },
    initialPageParam: 1,
    getNextPageParam: (last, _, page) => (page * RUNS_PAGE < last.total ? page + 1 : null),
    persister: persisted<{ total: number; runs: RunSummary[] }>,
  });

/**
 * What an Actions URL will show, started early by src/app/prefetch.ts. A dynamic workflow's runs wait for its
 * id, which only the workflow list knows.
 */
export function prefetchActions(client: QueryClient, owner: string, repo: string, workflow: string | undefined, url: URL) {
  client.prefetchQuery(workflowsQuery(owner, repo));
  const { filter, unknown } = parseRunQuery(url.searchParams.get('query') ?? '');
  if (!unknown.length && !workflow?.includes('/')) client.prefetchInfiniteQuery(runsQuery(owner, repo, workflow, filter));
}

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
