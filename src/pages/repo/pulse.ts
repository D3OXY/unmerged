import { queryOptions } from '@tanstack/react-query';
import { GitHubError, gql, rest } from '@/github/client';
import type { CheckState } from '@/github/types';
import { persisted } from '@/lib/persist';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** How many weeks the pulse covers, the current one last. */
export const PULSE_WEEKS = 12;

/**
 * The start of each of the last `PULSE_WEEKS` weeks (ms), oldest first. Weeks start on Sunday 00:00 UTC, as in
 * GitHub's weekly statistics, so code churn lines up with the counts.
 */
export function pulseWeeks(now: number): number[] {
  const day = Math.floor(now / DAY);
  // 1970-01-01 was a Thursday, four days after a Sunday.
  const sunday = (day - ((day + 4) % 7)) * DAY;
  return Array.from({ length: PULSE_WEEKS }, (_, i) => sunday - (PULSE_WEEKS - 1 - i) * WEEK);
}

export type Pulse = {
  /** Week starts (ms), oldest first; each series below has one value per week. */
  weeks: number[];
  /** Commits on the default branch. */
  commits: number[];
  /** Commits in the same length of time just before `weeks` began, for the trend. */
  commitsBefore: number;
  merged: number[];
  mergedBefore: number;
  /** Median hours from opening to merge, over up to 50 of the period's merged pull requests. */
  mergeHours: number | null;
  opened: number[];
  closed: number[];
  /** Check rollups of the default branch's last 20 commits, oldest first; null for a commit without checks. */
  checks: (CheckState | null)[];
  /** `unreleased` counts the default branch's commits since the release's tag. */
  release: { tagName: string; url: string; publishedAt: string | null; unreleased: number | null } | null;
};

type HeadData = {
  repository: {
    head: ({ recent: { nodes: { statusCheckRollup: { state: CheckState } | null }[] } } & Record<string, { totalCount: number }>) | null;
    latestRelease: { tagName: string; url: string; publishedAt: string | null; tag: { compare: { aheadBy: number } | null } | null } | null;
  } | null;
};

const iso = (ms: number) => new Date(ms).toISOString();
const date = (ms: number) => iso(ms).slice(0, 10);

/** Default-branch commits per week (aliased `history` counts), its CI, and the latest release. */
async function fetchHead(owner: string, name: string, weeks: number[], before: [number, number], signal: AbortSignal) {
  const counts = weeks.map((start, i) => `w${i}: history(since: "${iso(start)}", until: "${iso(start + WEEK)}") { totalCount }`).join(' ');
  const query = `query RepoPulse($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      head: object(expression: "HEAD") { ... on Commit {
        ${counts}
        before: history(since: "${iso(before[0])}", until: "${iso(before[1])}") { totalCount }
        recent: history(first: 20) { nodes { statusCheckRollup { state } } }
      } }
      latestRelease { tagName url publishedAt tag { compare(headRef: "HEAD") { aheadBy } } }
    }
  }`;
  return (await gql<HeadData>(query, { owner, name }, true, signal)).repository;
}

/** Issue-search result counts, one aliased `search` per query string, in one request. */
async function searchCounts(queries: string[], signal: AbortSignal) {
  const query = `query PulseCounts(${queries.map((_, i) => `$q${i}: String!`).join(', ')}) {
    ${queries.map((_, i) => `c${i}: search(type: ISSUE, first: 0, query: $q${i}) { issueCount }`).join(' ')}
  }`;
  const data = await gql<Record<string, { issueCount: number }>>(query, Object.fromEntries(queries.map((q, i) => [`q${i}`, q])), false, signal);
  return queries.map((_, i) => data[`c${i}`]?.issueCount ?? 0);
}

const MERGES_QUERY = /* GraphQL */ `
  query PulseMerges($q: String!) {
    search(type: ISSUE, first: 50, query: $q) { nodes { ... on PullRequest { createdAt mergedAt } } }
  }
`;

async function medianMergeHours(q: string, signal: AbortSignal) {
  const data = await gql<{ search: { nodes: { createdAt?: string; mergedAt?: string | null }[] } }>(MERGES_QUERY, { q }, false, signal);
  const hours = data.search.nodes
    .flatMap(({ createdAt, mergedAt }) => (createdAt && mergedAt ? [(Date.parse(mergedAt) - Date.parse(createdAt)) / 3_600_000] : []))
    .sort((a, b) => a - b);
  return hours.length ? hours[Math.floor(hours.length / 2)]! : null;
}

const key = (owner: string, name: string) => [owner.toLowerCase(), name.toLowerCase()] as const;

/**
 * The repo root's weekly activity. GitHub answers a request's fields one after another, so the counts go out
 * as parallel requests; searches cost a rate-limit point per request, not per alias.
 */
export const repoPulseQuery = (owner: string, name: string) =>
  queryOptions({
    queryKey: ['repo-pulse', ...key(owner, name)],
    queryFn: async ({ signal }): Promise<Pulse> => {
      // To the minute, so the page's request is the same as the one the background started early (github/early.ts).
      const now = Math.floor(Date.now() / 60_000) * 60_000;
      const weeks = pulseWeeks(now);
      const span = PULSE_WEEKS * WEEK;
      const before: [number, number] = [weeks[0]! - span, now - span];
      const repo = `repo:${owner}/${name}`;
      const ranges = weeks.map((start) => `${date(start)}..${date(start + WEEK - DAY)}`);
      const [repository, merged, opened, closed, mergeHours] = await Promise.all([
        fetchHead(owner, name, weeks, before, signal),
        searchCounts([...ranges, `${date(before[0])}..${date(before[1])}`].map((range) => `${repo} is:pr is:merged merged:${range}`), signal),
        searchCounts(ranges.map((range) => `${repo} is:issue created:${range}`), signal),
        searchCounts(ranges.map((range) => `${repo} is:issue closed:${range}`), signal),
        medianMergeHours(`${repo} is:pr is:merged merged:>=${date(weeks[0]!)} sort:updated-desc`, signal),
      ]);
      const head = repository?.head;
      const release = repository?.latestRelease;
      return {
        weeks,
        commits: weeks.map((_, i) => head?.[`w${i}`]?.totalCount ?? 0),
        commitsBefore: head?.before?.totalCount ?? 0,
        merged: merged.slice(0, -1),
        mergedBefore: merged.at(-1)!,
        mergeHours,
        opened,
        closed,
        checks: (head?.recent.nodes ?? []).map((commit) => commit.statusCheckRollup?.state ?? null).reverse(),
        release: release ? { tagName: release.tagName, url: release.url, publishedAt: release.publishedAt, unreleased: release.tag?.compare?.aheadBy ?? null } : null,
      };
    },
    staleTime: 10 * 60_000,
    persister: persisted,
  });

export type Churn = { weeks: number[]; additions: number[]; deletions: number[] };

/** GitHub's weekly code frequency (`[week start in s, additions, -deletions]`) for the pulse's weeks. */
export function churnFor(weeks: number[], stats: [number, number, number][]): Churn {
  const byWeek = new Map(stats.map(([week, additions, deletions]) => [week * 1000, [additions, -deletions] as const]));
  return { weeks, additions: weeks.map((week) => byWeek.get(week)?.[0] ?? 0), deletions: weeks.map((week) => byWeek.get(week)?.[1] ?? 0) };
}

/** GitHub answers 202 while it computes a repo's statistics; queries retry (`STATS_RETRY`) until they're ready. */
export class StatsPending extends Error {}

/** For a query of `fetchStats`: retries while GitHub is still counting, after 2, 4, 8 and 16 s (30 s in all). */
export const STATS_RETRY = { retry: (failures: number, error: Error) => error instanceof StatsPending && failures < 4, retryDelay: (failures: number) => 2_000 * 2 ** failures };

/** A repo's `/stats/<kind>` rows; none for an empty repo. Throws `StatsPending` while GitHub counts. */
export async function fetchStats<T>(owner: string, name: string, kind: 'code_frequency' | 'contributors', signal: AbortSignal): Promise<T[]> {
  // An empty body (204) is an empty repo; `{}` (202) means GitHub is still counting.
  const stats = await rest<T[] | Record<string, never> | undefined>(`/repos/${owner}/${name}/stats/${kind}`, { signal });
  if (stats && !Array.isArray(stats)) throw new StatsPending('GitHub is still counting');
  return stats ?? [];
}

/** Lines added and deleted per week; null when GitHub won't count them (repos with 10,000 commits or more). */
export const repoChurnQuery = (owner: string, name: string) =>
  queryOptions({
    queryKey: ['repo-churn', ...key(owner, name)],
    queryFn: async ({ signal }): Promise<Churn | null> => {
      try {
        return churnFor(pulseWeeks(Date.now()), await fetchStats<[number, number, number]>(owner, name, 'code_frequency', signal));
      } catch (error) {
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
    ...STATS_RETRY,
    staleTime: 60 * 60_000,
    persister: persisted,
  });
