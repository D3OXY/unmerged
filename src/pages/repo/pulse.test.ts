import { describe, expect, it } from 'vitest';
import { churnFor, PULSE_WEEKS, pulseWeeks } from './pulse';

describe('pulseWeeks', () => {
  it('ends with the Sunday-started UTC week holding now', () => {
    const now = Date.parse('2026-10-18T15:00:00Z'); // a Sunday
    const weeks = pulseWeeks(now);
    expect(weeks).toHaveLength(PULSE_WEEKS);
    expect(new Date(weeks.at(-1)!).toISOString()).toBe('2026-10-18T00:00:00.000Z');
    expect(new Date(weeks[0]!).toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(pulseWeeks(Date.parse('2026-10-24T23:59:59Z')).at(-1)).toBe(weeks.at(-1)); // the Saturday after
  });
});

describe('churnFor', () => {
  it("lines GitHub's weeks up with the pulse's and drops the rest", () => {
    const weeks = pulseWeeks(Date.parse('2026-10-18T15:00:00Z'));
    const thisWeek = weeks.at(-1)! / 1000;
    const churn = churnFor(weeks, [
      [weeks[0]! / 1000 - 604_800, 999, -999],
      [thisWeek - 604_800, 30, -4],
      [thisWeek, 12, -7],
    ]);
    expect(churn.additions.slice(-3)).toEqual([0, 30, 12]);
    expect(churn.deletions.slice(-3)).toEqual([0, 4, 7]);
    expect(churn.additions[0]).toBe(0);
  });
});
