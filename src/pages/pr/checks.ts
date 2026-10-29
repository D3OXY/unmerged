import type { CheckContext } from './query';

/**
 * ACTION_REQUIRED: the run waits for someone, such as a maintainer who must approve a fork's workflow run.
 * CANCELLED: someone or a newer run stopped it. It did not pass, but nothing in it failed.
 */
export type CheckOutcome = 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'PENDING' | 'NEUTRAL' | 'ACTION_REQUIRED';

/** Sort rank: outcomes that need attention first. */
export const ORDER: Record<CheckOutcome, number> = { FAILURE: 0, CANCELLED: 1, ACTION_REQUIRED: 2, PENDING: 3, SUCCESS: 4, NEUTRAL: 5 };

/** Collapses CheckRun status/conclusion and StatusContext state into one outcome. */
export function outcomeOf(check: CheckContext): CheckOutcome {
  if (check.__typename === 'StatusContext') {
    return check.state === 'SUCCESS' ? 'SUCCESS' : check.state === 'PENDING' || check.state === 'EXPECTED' ? 'PENDING' : 'FAILURE';
  }
  return runOutcome(check);
}

/** Outcome of a CheckRun from its status and conclusion. */
export function runOutcome(run: { status: string; conclusion: string | null }): CheckOutcome {
  if (run.status !== 'COMPLETED') return 'PENDING';
  if (run.conclusion === 'SUCCESS') return 'SUCCESS';
  if (run.conclusion === 'NEUTRAL' || run.conclusion === 'SKIPPED' || run.conclusion === 'STALE') return 'NEUTRAL';
  if (run.conclusion === 'ACTION_REQUIRED') return 'ACTION_REQUIRED';
  if (run.conclusion === 'CANCELLED') return 'CANCELLED';
  return 'FAILURE';
}

export function summarizeChecks(checks: CheckContext[]) {
  const counts: Record<CheckOutcome, number> = { SUCCESS: 0, FAILURE: 0, CANCELLED: 0, PENDING: 0, NEUTRAL: 0, ACTION_REQUIRED: 0 };
  for (const check of checks) counts[outcomeOf(check)]++;
  return counts;
}

export const checkName = (check: CheckContext) =>
  check.__typename === 'CheckRun'
    ? [check.checkSuite?.workflowRun?.workflow.name, check.name].filter(Boolean).join(' / ')
    : check.context;

export const checkUrl = (check: CheckContext) => (check.__typename === 'CheckRun' ? check.detailsUrl : check.targetUrl);
