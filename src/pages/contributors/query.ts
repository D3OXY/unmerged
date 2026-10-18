import { queryOptions } from '@tanstack/react-query';
import { persisted } from '@/lib/persist';
import { fetchStats, STATS_RETRY } from '@/pages/repo/pulse';

/** GitHub's `/stats/contributors` row: an author's weeks (start in s, additions, deletions, commits). Top 100 authors only. */
export type ContributorStats = { author: { login: string; avatar_url: string } | null; weeks: { w: number; a: number; d: number; c: number }[] };

/** One author's week with commits: its index in `Contributors.weeks`, then commits, additions, deletions. */
type ActiveWeek = [week: number, commits: number, additions: number, deletions: number];

/** The repo's contributors, stored sparse: most authors are active in a few of the repo's weeks. */
export type Contributors = {
  /** Week starts (ms), oldest first, from the repo's first commit to this week. */
  weeks: number[];
  authors: { login: string; avatarUrl: string; active: ActiveWeek[] }[];
  /** False when GitHub doesn't count lines (repos with 10,000 commits or more), where it sends zeros. */
  hasLines: boolean;
};

/** GitHub's rows as `Contributors`: weeks before the first commit dropped, and deleted users (no author) left out. */
export function compactStats(stats: ContributorStats[]): Contributors {
  const all = stats[0]?.weeks ?? [];
  const firstActive = Math.min(...stats.map((s) => s.weeks.findIndex((w) => w.c > 0)).filter((i) => i !== -1));
  const first = Number.isFinite(firstActive) ? firstActive : all.length;
  return {
    weeks: all.slice(first).map((w) => w.w * 1000),
    authors: stats.flatMap(({ author, weeks }) =>
      author ? [{ login: author.login, avatarUrl: author.avatar_url, active: weeks.flatMap(({ c, a, d }, i): ActiveWeek[] => (c ? [[i - first, c, a, d]] : [])) }] : [],
    ),
    hasLines: stats.some((s) => s.weeks.some((w) => w.a || w.d)),
  };
}

export type Metric = 'commits' | 'additions' | 'deletions';

const METRICS = ['commits', 'additions', 'deletions'] as const satisfies Metric[];

/** Weekly values of each metric, and their totals. */
export type Activity = { weekly: Record<Metric, number[]>; totals: Record<Metric, number> };

export type ContributorRow = Activity & { login: string; avatarUrl: string };

/**
 * What the page shows for the last `months` (all of it when null): the weeks in that time, everyone's activity
 * summed, and each author active in it, ranked by `metric` (then commits).
 */
export function contributorsIn(data: Contributors, months: number | null, metric: Metric) {
  const last = data.weeks.at(-1);
  const from = months === null || last === undefined ? -Infinity : new Date(last).setUTCMonth(new Date(last).getUTCMonth() - months);
  const start = Math.max(0, data.weeks.findIndex((week) => week >= from));
  const weeks = data.weeks.slice(start);
  const empty = (): Activity => ({
    weekly: { commits: weeks.map(() => 0), additions: weeks.map(() => 0), deletions: weeks.map(() => 0) },
    totals: { commits: 0, additions: 0, deletions: 0 },
  });
  const add = (into: Activity, i: number, values: number[]) =>
    METRICS.forEach((m, j) => {
      into.weekly[m][i]! += values[j]!;
      into.totals[m] += values[j]!;
    });

  const everyone = empty();
  const rows = data.authors
    .flatMap(({ login, avatarUrl, active }) => {
      const row: ContributorRow = { login, avatarUrl, ...empty() };
      for (const [week, ...values] of active) {
        if (week < start) continue;
        add(row, week - start, values);
        add(everyone, week - start, values);
      }
      return row.totals.commits ? [row] : [];
    })
    .sort((a, b) => b.totals[metric] - a.totals[metric] || b.totals.commits - a.totals.commits);
  return { weeks, everyone, rows };
}

/** The repo's contributors to the default branch, merge commits left out (GitHub's counting). Works on private repos too. */
export const contributorsQuery = (owner: string, name: string) =>
  queryOptions({
    queryKey: ['repo-contributor-stats', owner.toLowerCase(), name.toLowerCase()],
    queryFn: async ({ signal }) => compactStats(await fetchStats<ContributorStats>(owner, name, 'contributors', signal)),
    ...STATS_RETRY,
    staleTime: 60 * 60_000,
    persister: persisted,
  });
