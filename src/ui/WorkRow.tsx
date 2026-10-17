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

/** How a row names its repo: not at all (inside the repo), by `name`, or as `owner/name`. */
export type RepoLabel = 'none' | 'name' | 'full';

/** `full` when the rows come from more than one owner, so forks and same-named repos don't look alike. */
export const repoLabelFor = (items: { repository: { nameWithOwner: string } }[]): RepoLabel =>
  new Set(items.map((item) => item.repository.nameWithOwner.split('/')[0])).size > 1 ? 'full' : 'name';

/**
 * One dense, keyboard-focusable line for a PR or issue (Linear's list row). `peek` opens it in the list's side
 * panel on a plain click (new tabs still get its page); `selected` marks the one open there.
 */
export function WorkRow(row: ({ kind: 'pr'; item: PrRowData } | { kind: 'issue'; item: IssueRowData }) & { repo?: RepoLabel; peek?: boolean; selected?: boolean }) {
  const { item, repo = 'name', peek, selected } = row;
  const pr = row.kind === 'pr' ? row.item : null;
  const checks = pr?.commits.nodes[0]?.commit.statusCheckRollup?.state;
  return (
    <a
      href={item.url}
      data-row
      data-peek={peek || undefined}
      aria-current={selected || undefined}
      className={cx(
        'group relative flex h-10 items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none',
        selected && 'bg-hover before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent',
      )}
    >
      {row.kind === 'pr' ? <PrStateIcon state={row.item.state} isDraft={row.item.isDraft} /> : <IssueIcon state={row.item.state} stateReason={row.item.stateReason} />}
      <span className={cx('flex shrink-0 gap-1 text-[12px] text-subtle tabular-nums', repo === 'none' ? 'w-14' : repo === 'name' ? 'w-[150px]' : 'w-[220px]')}>
        {repo !== 'none' && <span className="truncate">{repo === 'full' ? item.repository.nameWithOwner : item.repository.nameWithOwner.split('/')[1]}</span>}
        <span className="shrink-0">#{item.number}</span>
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-fg/95">{item.title}</span>
      <span className="hidden shrink-0 items-center gap-1 @4xl:flex">
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
