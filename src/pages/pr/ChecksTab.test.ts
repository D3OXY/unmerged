import { describe, expect, it } from 'vitest';
import { runsUnfinished } from './ChecksTab';

/** The Checks tab's answer for commit `oid`, with runs in the given statuses. */
const answer = (oid: string, ...statuses: string[]) =>
  ({ node: { commits: { nodes: [{ commit: { oid, checkSuites: { nodes: [{ checkRuns: { nodes: statuses.map((status) => ({ status })) } }] } } }] } } }) as Parameters<
    typeof runsUnfinished
  >[0];

describe('runsUnfinished', () => {
  it('is true while a run on the head commit is unfinished', () => {
    expect(runsUnfinished(answer('head', 'COMPLETED', 'IN_PROGRESS'), 'head')).toBe(true);
    expect(runsUnfinished(answer('head', 'COMPLETED', 'COMPLETED'), 'head')).toBe(false);
  });

  it('is false for another commit, so the status poll takes over and sees the push', () => {
    expect(runsUnfinished(answer('new', 'QUEUED'), 'head')).toBe(false);
  });
});
