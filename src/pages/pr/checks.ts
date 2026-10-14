import type { CheckContext } from './query';

export type CheckOutcome = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'NEUTRAL';

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
  return 'FAILURE';
}

export function summarizeChecks(checks: CheckContext[]) {
  const counts: Record<CheckOutcome, number> = { SUCCESS: 0, FAILURE: 0, PENDING: 0, NEUTRAL: 0 };
  for (const check of checks) counts[outcomeOf(check)]++;
  return counts;
}

export const checkName = (check: CheckContext) =>
  check.__typename === 'CheckRun'
    ? [check.checkSuite?.workflowRun?.workflow.name, check.name].filter(Boolean).join(' / ')
    : check.context;

export const checkUrl = (check: CheckContext) => (check.__typename === 'CheckRun' ? check.detailsUrl : check.targetUrl);
