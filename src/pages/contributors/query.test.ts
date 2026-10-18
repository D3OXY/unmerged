import { describe, expect, it } from 'vitest';
import { compactStats, contributorsIn, type ContributorStats } from './query';

const WEEK = 7 * 86_400;
// Weeks starting Sun 2026-01-04, 2026-01-11, …; the API lists every author over the same weeks.
const start = Date.UTC(2026, 0, 4) / 1000;
const author = (login: string, weeks: [c: number, a: number, d: number][]): ContributorStats => ({
  author: { login, avatar_url: `https://avatars/${login}` },
  weeks: weeks.map(([c, a, d], i) => ({ w: start + i * WEEK, c, a, d })),
});

const stats = [
  author('ada', [[0, 0, 0], [2, 10, 1], [0, 0, 0], [1, 5, 5]]),
  author('bob', [[0, 0, 0], [0, 0, 0], [4, 1, 0], [0, 0, 0]]),
  { ...author('ghost', [[0, 0, 0], [9, 9, 9], [0, 0, 0], [0, 0, 0]]), author: null },
];

describe('compactStats', () => {
  it('starts at the first week anyone committed, keeps only active weeks, and drops deleted users', () => {
    // The deleted user's week 1 still starts the range; their commits are left out.
    expect(compactStats(stats)).toEqual({
      weeks: [1, 2, 3].map((i) => (start + i * WEEK) * 1000),
      authors: [
        { login: 'ada', avatarUrl: 'https://avatars/ada', active: [[0, 2, 10, 1], [2, 1, 5, 5]] },
        { login: 'bob', avatarUrl: 'https://avatars/bob', active: [[1, 4, 1, 0]] },
      ],
      hasLines: true,
    });
  });

  it('notices when GitHub sends no line counts', () => {
    expect(compactStats([author('ada', [[1, 0, 0]])]).hasLines).toBe(false);
    expect(compactStats([])).toEqual({ weeks: [], authors: [], hasLines: false });
  });
});

describe('contributorsIn', () => {
  const data = compactStats(stats);

  it('ranks by the chosen metric and sums everyone per week', () => {
    const all = contributorsIn(data, null, 'commits');
    expect(all.rows.map((r) => [r.login, r.totals.commits])).toEqual([['bob', 4], ['ada', 3]]);
    expect(all.everyone.weekly.commits).toEqual([2, 4, 1]);
    expect(all.everyone.totals).toEqual({ commits: 7, additions: 16, deletions: 6 });
    expect(contributorsIn(data, null, 'additions').rows[0]!.weekly.additions).toEqual([10, 0, 5]);
  });

  it('keeps the weeks in the last months, and only the authors active then', () => {
    // Weeks spread a month apart: only the last is within a month of the latest.
    const long = { ...data, weeks: data.weeks.map((w, i) => w + i * 30 * 86_400_000) };
    const recent = contributorsIn(long, 1, 'commits');
    expect(recent.weeks).toEqual(long.weeks.slice(2));
    expect(recent.rows.map((r) => [r.login, r.weekly.commits])).toEqual([['ada', [1]]]);
  });
});
