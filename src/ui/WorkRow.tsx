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
    repository { nameWithOwner isPrivate }
    author { login avatarUrl }
    comments { totalCount }
    labels(first: 3) { nodes { name color } }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }
`;

export const ISSUE_ROW_FIELDS = /* GraphQL */ `
  fragment IssueRow on Issue {
    id number title url updatedAt state stateReason
    repository { nameWithOwner isPrivate }
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
  /** `isPrivate` is missing from a result stored before it was asked for; Privacy then blurs the row. */
  repository: { nameWithOwner: string; isPrivate?: boolean };
  author: Actor;
  labels: { nodes: Label[] };
};

export type PrRowItem = RowBase & { isDraft: boolean; state: PrState };
export type IssueRowItem = RowBase & { state: IssueState; stateReason: IssueStateReason | null };

/** What a row shows that GitHub's search works out slowly, so a list can ask for it after the rows (by id). */
export type IssueRowDetails = { comments: { totalCount: number } };
export type PrRowDetails = IssueRowDetails & {
  reviewDecision: ReviewDecision;
  commits: { nodes: { commit: { statusCheckRollup: { state: CheckState } | null } }[] };
};

/** A row's details as a list has them: undefined while they load, null when they couldn't. */
export type Details<T> = T | null | undefined;

export type PrRowData = PrRowItem & PrRowDetails;
export type IssueRowData = IssueRowItem & IssueRowDetails;

/** How a row names its repo: not at all (inside the repo), by `name`, or as `owner/name`. */
export type RepoLabel = 'none' | 'name' | 'full';

/** `full` when the rows come from more than one owner, so forks and same-named repos don't look alike. */
export const repoLabelFor = (items: { repository: { nameWithOwner: string } }[]): RepoLabel =>
  new Set(items.map((item) => item.repository.nameWithOwner.split('/')[0])).size > 1 ? 'full' : 'name';

/**
 * Stands in for details a row doesn't have: a still bar while they load (no animation: a list has many), a
 * dash when they couldn't load. It fills no more than the column it's in, so the row doesn't move.
 */
export function NotLoaded({ failed, className }: { failed: boolean; className: string }) {
  return failed ? (
    <span title="Couldn’t load" className="text-[12px] text-subtle">
      –
    </span>
  ) : (
    <span aria-hidden className={cx('h-2.5 rounded-sm bg-elevated', className)} />
  );
}

/**
 * One dense, keyboard-focusable line for a PR or issue (Linear's list row). `details` are its comments, and a
 * PR's review and CI, which a list may load after the row. `peek` opens it in the list's side panel on a plain
 * click (new tabs still get its page); `selected` marks the one open there.
 */
export function WorkRow(
  row: ({ kind: 'pr'; item: PrRowItem } | { kind: 'issue'; item: IssueRowItem }) & {
    details: Details<IssueRowDetails | PrRowDetails>;
    repo?: RepoLabel;
    peek?: boolean;
    selected?: boolean;
  },
) {
  const { item, details, repo = 'name', peek, selected } = row;
  const prDetails = details && 'commits' in details ? details : undefined;
  const missing = (className: string) => !details && <NotLoaded failed={details === null} className={className} />;
  return (
    <a
      href={item.url}
      data-row
      data-peek={peek || undefined}
      data-repo-private={item.repository.isPrivate !== false || undefined}
      aria-current={selected || undefined}
      className={cx(
        'group relative flex h-10 items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none',
        selected && 'bg-hover before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent',
      )}
    >
      {row.kind === 'pr' ? <PrStateIcon state={row.item.state} isDraft={row.item.isDraft} /> : <IssueIcon state={row.item.state} stateReason={row.item.stateReason} />}
      <span className={cx('flex shrink-0 gap-1 text-[12px] text-subtle tabular-nums', repo === 'none' ? 'w-14' : repo === 'name' ? 'w-[150px]' : 'w-[220px]')}>
        {repo !== 'none' && <span data-private="repos" className="truncate">{repo === 'full' ? item.repository.nameWithOwner : item.repository.nameWithOwner.split('/')[1]}</span>}
        <span className="shrink-0">#{item.number}</span>
      </span>
      <span data-private="titles" className="min-w-0 flex-1 truncate font-medium text-fg/95">
        {item.title}
      </span>
      <span className="hidden shrink-0 items-center gap-1 @4xl:flex">
        {item.labels.nodes.map((label) => (
          <Pill key={label.name} color={label.color}>
            {label.name}
          </Pill>
        ))}
      </span>
      {/* A fixed width, so the review landing late doesn't push the title. */}
      {row.kind === 'pr' && <span className="flex w-14 shrink-0 justify-end">{prDetails ? <ReviewBadge decision={prDetails.reviewDecision} /> : missing('w-10')}</span>}
      <span className="flex w-4 justify-center">{prDetails ? <CheckIcon state={prDetails.commits.nodes[0]?.commit.statusCheckRollup?.state} /> : row.kind === 'pr' && missing('w-3.5')}</span>
      <span className="flex w-8 items-center gap-1 text-[12px] text-subtle tabular-nums">
        {details
          ? details.comments.totalCount > 0 && (
              <>
                <HugeiconsIcon icon={Comment01Icon} className="size-3" />
                {details.comments.totalCount}
              </>
            )
          : missing('w-5')}
      </span>
      <Avatar src={item.author?.avatarUrl} size={18} />
      <span className="w-16 shrink-0 text-right text-[12px] text-subtle">{timeAgo(item.updatedAt)}</span>
    </a>
  );
}
