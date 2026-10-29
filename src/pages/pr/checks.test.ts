import { describe, expect, it } from 'vitest';
import { runOutcome } from './checks';

const done = (conclusion: string) => runOutcome({ status: 'COMPLETED', conclusion });

describe('runOutcome', () => {
  it('is pending until the run completes', () => {
    expect(runOutcome({ status: 'IN_PROGRESS', conclusion: null })).toBe('PENDING');
  });

  it('keeps a run that waits for approval apart from a failure', () => {
    expect(done('ACTION_REQUIRED')).toBe('ACTION_REQUIRED');
    expect(done('FAILURE')).toBe('FAILURE');
  });

  it('keeps a cancelled run apart from a failure', () => {
    expect(done('CANCELLED')).toBe('CANCELLED');
    expect(done('TIMED_OUT')).toBe('FAILURE');
  });

  it('shows skipped, neutral and stale runs as neutral', () => {
    expect(['SKIPPED', 'NEUTRAL', 'STALE'].map(done)).toEqual(['NEUTRAL', 'NEUTRAL', 'NEUTRAL']);
  });
});
