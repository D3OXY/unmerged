import { describe, expect, it } from 'vitest';
import type { CheckState, ReviewDecision } from '@/github/types';
import { standing } from './queries';

describe('standing', () => {
  it.each<[ReviewDecision, CheckState | null, boolean, ReturnType<typeof standing>]>([
    ['CHANGES_REQUESTED', 'SUCCESS', false, 'fix'],
    ['APPROVED', 'FAILURE', false, 'fix'],
    [null, 'ERROR', false, 'fix'],
    // A draft still needs fixing when CI fails.
    ['REVIEW_REQUIRED', 'FAILURE', true, 'fix'],
    ['APPROVED', 'SUCCESS', false, 'ready'],
    ['APPROVED', null, false, 'ready'],
    ['APPROVED', 'PENDING', false, 'waiting'],
    ['APPROVED', 'SUCCESS', true, 'waiting'],
    ['REVIEW_REQUIRED', 'SUCCESS', false, 'waiting'],
    // No required review isn't an approval.
    [null, 'SUCCESS', false, 'waiting'],
  ])('review %s, checks %s, draft %s → %s', (reviewDecision, checks, isDraft, expected) => {
    const commits = { nodes: [{ commit: { statusCheckRollup: checks && { state: checks } } }] };
    expect(standing({ reviewDecision, isDraft, commits })).toBe(expected);
  });
});
