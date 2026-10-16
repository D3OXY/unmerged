import { HugeiconsIcon } from '@hugeicons/react';
import { Comment01Icon } from '@hugeicons/core-free-icons';
import type { Actor, CheckState, IssueState, IssueStateReason, Label, PrState, ReviewDecision } from '@/github/types';
import { cx } from '@/lib/cx';
import { timeAgo } from '@/lib/time';
import { Avatar, Pill } from './primitives';
import { CheckIcon, IssueIcon, PrStateIcon, ReviewBadge } from './status';

export const PR_ROW_FIELDS = /* GraphQL */ `
  fragment PrRow on PullRequest {
    id number title url isDraft state updatedAt reviewDecision
    repository { nameWithOwner }
    author { login avatarUrl }
    comments { totalCount }
    labels(first: 3) { nodes { name color } }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }
`;

export const ISSUE_ROW_FIELDS = /* GraphQL */ `
  fragment IssueRow on Issue {
    id number title url updatedAt state stateReason
    repository { nameWithOwner }
    author { login avatarUrl }
    comments { totalCount }
    labels(first: 3) { nodes { name color } }
  }
`;

type RowBase = {
  id: string;
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  repository: { nameWithOwner: string };
  author: Actor;
  comments: { totalCount: number };
  labels: { nodes: Label[] };
};

export type PrRowData = RowBase & {
  isDraft: boolean;
  state: PrState;
  reviewDecision: ReviewDecision;
  commits: { nodes: { commit: { statusCheckRollup: { state: CheckState } | null } }[] };
};

export type IssueRowData = RowBase & { state: IssueState; stateReason: IssueStateReason | null };

/** One dense, keyboard-focusable line for a PR or issue (Linear's list row). `inRepo` drops the repo name. */
export function WorkRow(row: ({ kind: 'pr'; item: PrRowData } | { kind: 'issue'; item: IssueRowData }) & { inRepo?: boolean }) {
  const { item } = row;
  const pr = row.kind === 'pr' ? row.item : null;
  const checks = pr?.commits.nodes[0]?.commit.statusCheckRollup?.state;
  return (
    <a
      href={item.url}
      data-row
      className="group flex h-10 items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none"
    >
      {row.kind === 'pr' ? <PrStateIcon state={row.item.state} isDraft={row.item.isDraft} /> : <IssueIcon state={row.item.state} stateReason={row.item.stateReason} />}
      <span className={cx('shrink-0 truncate text-[12px] text-subtle tabular-nums', row.inRepo ? 'w-14' : 'w-[150px]')}>
        {!row.inRepo && `${item.repository.nameWithOwner.split('/')[1]} `}#{item.number}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-fg/95">{item.title}</span>
      <span className="hidden shrink-0 items-center gap-1 xl:flex">
        {item.labels.nodes.map((label) => (
          <Pill key={label.name} color={label.color}>
            {label.name}
          </Pill>
        ))}
      </span>
      {pr && <ReviewBadge decision={pr.reviewDecision} />}
      <span className="flex w-4 justify-center">
        <CheckIcon state={checks} />
      </span>
      <span className="flex w-8 items-center gap-1 text-[12px] text-subtle tabular-nums">
        {item.comments.totalCount > 0 && (
          <>
            <HugeiconsIcon icon={Comment01Icon} className="size-3" />
            {item.comments.totalCount}
          </>
        )}
      </span>
      <Avatar src={item.author?.avatarUrl} size={18} />
      <span className="w-16 shrink-0 text-right text-[12px] text-subtle">{timeAgo(item.updatedAt)}</span>
    </a>
  );
}
