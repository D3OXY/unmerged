import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CheckmarkCircle02Icon, CircleDotIcon, CircleIcon, GitMergeIcon, GitPullRequestClosedIcon, GitPullRequestDraftIcon, GitPullRequestIcon, Tick02Icon, UnavailableIcon } from '@hugeicons/core-free-icons';
import type { CheckState, IssueState, IssueStateReason, PrState, ReviewDecision } from '@/github/types';
import { cx } from '@/lib/cx';

export function PrStateIcon({ state, isDraft, className }: { state: PrState; isDraft?: boolean; className?: string }) {
  const c = cx('size-4 shrink-0', className);
  if (state === 'MERGED') return <HugeiconsIcon icon={GitMergeIcon} className={cx(c, 'text-merged')} />;
  if (state === 'CLOSED') return <HugeiconsIcon icon={GitPullRequestClosedIcon} className={cx(c, 'text-danger')} />;
  if (isDraft) return <HugeiconsIcon icon={GitPullRequestDraftIcon} className={cx(c, 'text-subtle')} />;
  return <HugeiconsIcon icon={GitPullRequestIcon} className={cx(c, 'text-success')} />;
}

/** Open, closed as completed (purple check) or closed as not planned (grey slash), like GitHub. */
export function IssueIcon({ state = 'OPEN', stateReason, className }: { state?: IssueState; stateReason?: IssueStateReason | null; className?: string }) {
  const c = cx('size-4 shrink-0', className);
  if (state === 'OPEN') return <HugeiconsIcon icon={CircleDotIcon} className={cx(c, 'text-success')} />;
  if (stateReason === 'NOT_PLANNED' || stateReason === 'DUPLICATE') return <HugeiconsIcon icon={UnavailableIcon} className={cx(c, 'text-subtle')} />;
  return <HugeiconsIcon icon={CheckmarkCircle02Icon} className={cx(c, 'text-merged')} />;
}

export function PrStateBadge({ state, isDraft }: { state: PrState; isDraft: boolean }) {
  const label = state === 'OPEN' ? (isDraft ? 'Draft' : 'Open') : state === 'MERGED' ? 'Merged' : 'Closed';
  const tone =
    state === 'MERGED'
      ? 'text-merged bg-merged/10 border-merged/25'
      : state === 'CLOSED'
        ? 'text-danger bg-danger/10 border-danger/25'
        : isDraft
          ? 'text-muted bg-hover border-line'
          : 'text-success bg-success/10 border-success/25';
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium', tone)}>
      <PrStateIcon state={state} isDraft={isDraft} className="size-3.5 text-current" />
      {label}
    </span>
  );
}

const checkTone: Record<CheckState, string> = {
  SUCCESS: 'text-success',
  FAILURE: 'text-danger',
  ERROR: 'text-danger',
  PENDING: 'text-warning',
  EXPECTED: 'text-warning',
};

export function CheckIcon({ state, className }: { state: CheckState | null | undefined; className?: string }) {
  if (!state) return null;
  const c = cx('size-3.5 shrink-0', checkTone[state], className);
  if (state === 'SUCCESS') return <HugeiconsIcon icon={Tick02Icon} className={c} strokeWidth={2.5} />;
  if (state === 'FAILURE' || state === 'ERROR') return <HugeiconsIcon icon={Cancel01Icon} className={c} strokeWidth={2.5} />;
  return (
    <span className={cx('relative inline-flex', c)}>
      <HugeiconsIcon icon={CircleIcon} className="size-full" strokeWidth={2.5} />
      <span className="absolute inset-[30%] animate-ping rounded-full bg-current opacity-60" />
    </span>
  );
}

export function ReviewBadge({ decision }: { decision: ReviewDecision }) {
  if (!decision) return null;
  const map = {
    APPROVED: ['Approved', 'text-success'],
    CHANGES_REQUESTED: ['Changes', 'text-danger'],
    REVIEW_REQUIRED: ['Review', 'text-subtle'],
  } as const;
  const [label, tone] = map[decision];
  return <span className={cx('text-[11.5px] font-medium', tone)}>{label}</span>;
}
