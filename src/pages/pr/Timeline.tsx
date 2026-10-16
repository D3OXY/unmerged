import type { ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CircleDotIcon, Comment01Icon, Delete02Icon, FlashIcon, FlashOffIcon, GitCommitHorizontalIcon, GitMergeIcon, GitPullRequestDraftIcon, Link02Icon, PencilEdit02Icon, Tag01Icon, Tick02Icon, UndoIcon, Unlink02Icon, Upload01Icon, UserAdd01Icon, UserRemove01Icon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import type { Actor } from '@/github/types';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { fullDate, timeAgo } from '@/lib/time';
import { Avatar, Markdown, Pill } from '@/ui/primitives';
import { CheckIcon, IssueIcon, PrStateIcon } from '@/ui/status';
import { CommentBody, type Editable } from './CommentBody';
import type { Reference, ReviewState, TimelineItem } from './query';

/** Activity feed: comments as cards, everything else as quiet one-liners on a rail. */
export function Timeline({ items, hiddenCount, queryKey }: { items: TimelineItem[]; hiddenCount: number; queryKey: QueryKey }) {
  return (
    <div className="relative">
      <div className="absolute top-2 bottom-2 left-[15px] w-px bg-line" />
      {hiddenCount > 0 && (
        <EventLine icon={<HugeiconsIcon icon={Comment01Icon} />}>
          {hiddenCount} earlier events aren't shown.
          <button type="button" onClick={openClassic} className="cursor-pointer text-accent hover:underline">
            View in classic
          </button>
        </EventLine>
      )}
      {items.map((item) => (
        <TimelineEntry key={item.id} item={item} queryKey={queryKey} />
      ))}
    </div>
  );
}

function TimelineEntry({ item, queryKey }: { item: TimelineItem; queryKey: QueryKey }) {
  switch (item.__typename) {
    case 'IssueComment':
      return <CommentCard author={item.author} createdAt={item.createdAt} html={item.bodyHTML} editable={{ kind: 'comment', node: item, queryKey }} />;
    case 'PullRequestReview':
      return <Review item={item} />;
    case 'PullRequestCommit': {
      const { commit } = item;
      const user = commit.author?.user;
      return (
        <EventLine icon={<HugeiconsIcon icon={GitCommitHorizontalIcon} />}>
          <a href={commit.url} className="flex min-w-0 items-center gap-2 hover:text-fg">
            {user && <Avatar src={user.avatarUrl} size={16} />}
            <span className="truncate text-fg/90">{commit.messageHeadline}</span>
          </a>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <CheckIcon state={commit.statusCheckRollup?.state} />
            <code className="font-mono text-[11.5px] text-subtle">{commit.abbreviatedOid}</code>
          </span>
        </EventLine>
      );
    }
    case 'MergedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={GitMergeIcon} />} tone="merged" actor={item.actor} at={item.createdAt}>
          merged {item.commit && <code className="font-mono text-fg/90">{item.commit.abbreviatedOid}</code>} into{' '}
          <code className="font-mono text-fg/90">{item.mergeRefName}</code>
        </EventLine>
      );
    case 'ClosedEvent':
      return <EventLine icon={<HugeiconsIcon icon={Cancel01Icon} />} tone="danger" actor={item.actor} at={item.createdAt}>closed this</EventLine>;
    case 'ReopenedEvent':
      return <EventLine icon={<HugeiconsIcon icon={UndoIcon} />} tone="success" actor={item.actor} at={item.createdAt}>reopened this</EventLine>;
    case 'HeadRefForcePushedEvent':
      return <EventLine icon={<HugeiconsIcon icon={Upload01Icon} />} actor={item.actor} at={item.createdAt}>force-pushed the branch</EventLine>;
    case 'HeadRefDeletedEvent':
      return <EventLine icon={<HugeiconsIcon icon={Delete02Icon} />} actor={item.actor} at={item.createdAt}>deleted the branch</EventLine>;
    case 'ReadyForReviewEvent':
      return <EventLine icon={<HugeiconsIcon icon={ViewIcon} />} actor={item.actor} at={item.createdAt}>marked this ready for review</EventLine>;
    case 'ConvertToDraftEvent':
      return <EventLine icon={<HugeiconsIcon icon={GitPullRequestDraftIcon} />} actor={item.actor} at={item.createdAt}>converted this to a draft</EventLine>;
    case 'LabeledEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Tag01Icon} />} actor={item.actor} at={item.createdAt}>
          added <Pill color={item.label.color}>{item.label.name}</Pill>
        </EventLine>
      );
    case 'RenamedTitleEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={PencilEdit02Icon} />} actor={item.actor} at={item.createdAt}>
          renamed from <span className="text-fg/80 line-through decoration-subtle">{item.previousTitle}</span>
        </EventLine>
      );
    case 'ReviewRequestedEvent': {
      const who = item.requestedReviewer?.login ?? item.requestedReviewer?.name;
      return (
        <EventLine icon={<HugeiconsIcon icon={ViewIcon} />} actor={item.actor} at={item.createdAt}>
          requested review{who && <> from <span className="font-medium text-fg/90">{who}</span></>}
        </EventLine>
      );
    }
    case 'CrossReferencedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Link02Icon} />} actor={item.actor} at={item.createdAt}>
          mentioned this in <RefLink subject={item.source} />
        </EventLine>
      );
    case 'ConnectedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Link02Icon} />} actor={item.actor} at={item.createdAt}>
          linked <RefLink subject={item.subject} />
        </EventLine>
      );
    case 'DisconnectedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Unlink02Icon} />} actor={item.actor} at={item.createdAt}>
          unlinked <RefLink subject={item.subject} />
        </EventLine>
      );
    case 'AssignedEvent':
    case 'UnassignedEvent': {
      const assigned = item.__typename === 'AssignedEvent';
      const who = item.assignee?.login;
      return (
        <EventLine icon={<HugeiconsIcon icon={assigned ? UserAdd01Icon : UserRemove01Icon} />} actor={item.actor} at={item.createdAt}>
          {who === item.actor?.login ? (
            assigned ? 'self-assigned this' : 'removed their assignment'
          ) : (
            <>
              {assigned ? 'assigned' : 'unassigned'} <span className="font-medium text-fg/90">{who}</span>
            </>
          )}
        </EventLine>
      );
    }
    case 'UnlabeledEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Tag01Icon} />} actor={item.actor} at={item.createdAt}>
          removed <Pill color={item.label.color}>{item.label.name}</Pill>
        </EventLine>
      );
    case 'ReviewDismissedEvent': {
      const reviewer = item.review?.author?.login;
      return (
        <EventLine icon={<HugeiconsIcon icon={ViewOffIcon} />} actor={item.actor} at={item.createdAt}>
          <span className="shrink-0">
            dismissed {reviewer ? <><span className="font-medium text-fg/90">{reviewer}</span>'s</> : 'a'} review
          </span>
          {item.dismissalMessage && <span className="min-w-0 truncate text-subtle" title={item.dismissalMessage}>: {item.dismissalMessage}</span>}
        </EventLine>
      );
    }
    case 'AutoMergeEnabledEvent':
      return <EventLine icon={<HugeiconsIcon icon={FlashIcon} />} actor={item.actor} at={item.createdAt}>enabled auto-merge</EventLine>;
    case 'AutoMergeDisabledEvent':
      return <EventLine icon={<HugeiconsIcon icon={FlashOffIcon} />} actor={item.actor} at={item.createdAt}>disabled auto-merge</EventLine>;
    case 'BaseRefForcePushedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Upload01Icon} />} actor={item.actor} at={item.createdAt}>
          force-pushed the base branch{item.ref && <code className="font-mono text-fg/90">{item.ref.name}</code>}
        </EventLine>
      );
  }
}

/** An issue or pull request named in an event, with its state icon. */
function RefLink({ subject }: { subject: Reference }) {
  return (
    <a href={subject.url} className="flex min-w-0 items-center gap-1 text-fg/90 hover:underline">
      {subject.__typename === 'Issue' ? <IssueIcon state={subject.state} stateReason={subject.stateReason} className="size-3.5" /> : <PrStateIcon state={subject.state} className="size-3.5" />}
      <span className="truncate">{subject.title}</span>
      <span className="shrink-0 text-subtle">
        {subject.repository.nameWithOwner}#{subject.number}
      </span>
    </a>
  );
}

const REVIEW_COPY: Record<ReviewState, { verb: string; icon: ReactNode; tone?: 'success' | 'danger' }> = {
  APPROVED: { verb: 'approved these changes', icon: <HugeiconsIcon icon={Tick02Icon} />, tone: 'success' },
  CHANGES_REQUESTED: { verb: 'requested changes', icon: <HugeiconsIcon icon={CircleDotIcon} />, tone: 'danger' },
  COMMENTED: { verb: 'reviewed', icon: <HugeiconsIcon icon={ViewIcon} /> },
  DISMISSED: { verb: 'left a dismissed review', icon: <HugeiconsIcon icon={ViewIcon} /> },
  PENDING: { verb: 'started a review', icon: <HugeiconsIcon icon={ViewIcon} /> },
};

function Review({ item }: { item: Extract<TimelineItem, { __typename: 'PullRequestReview' }> }) {
  const copy = REVIEW_COPY[item.state];
  const at = item.submittedAt ?? item.createdAt;
  return (
    <>
      <EventLine icon={copy.icon} tone={copy.tone} actor={item.author} at={at}>
        {copy.verb}
      </EventLine>
      {item.bodyHTML && <CommentCard author={item.author} createdAt={at} html={item.bodyHTML} nested />}
    </>
  );
}

/** Says how many of something were cut off by our query's page size, with a way to see them. */
export function MoreOnGitHub({ count, noun, className }: { count: number; noun: string; className?: string }) {
  return (
    <p className={cx('text-[12px] text-subtle', className)}>
      {count} more {noun} on GitHub ·{' '}
      <button type="button" onClick={openClassic} className="cursor-pointer text-accent hover:underline">
        View in classic
      </button>
    </p>
  );
}

/** A comment in a card. `editable` adds reactions and, where allowed, edit and delete. */
export function CommentCard({ author, createdAt, html, nested, editable }: { author: Actor; createdAt: string; html: string; nested?: boolean; editable?: Editable }) {
  return (
    <div className={cx('relative py-2.5', nested ? 'pl-10' : 'pl-0')}>
      <div className="flex gap-3">
        {!nested && <Avatar src={author?.avatarUrl} size={32} className="relative z-10 ring-4 ring-bg" />}
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex h-9 items-center gap-2 border-b border-line px-4 text-[12.5px]">
            {author && (
              <a href={`/${author.login}`} className="font-semibold hover:underline">
                {author.login}
              </a>
            )}
            <span className="text-subtle" title={fullDate(createdAt)}>
              {timeAgo(createdAt)}
            </span>
          </div>
          <div className="px-4 py-3">
            {editable ? <CommentBody html={html} {...editable} /> : html ? <Markdown html={html} /> : <span className="text-subtle italic">No description provided.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventLine({
  icon,
  tone,
  actor,
  at,
  children,
}: {
  icon: ReactNode;
  tone?: 'success' | 'danger' | 'merged';
  actor?: Actor;
  at?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-9 items-center gap-3 py-1 text-[12.5px] text-muted">
      <span
        className={cx(
          'relative z-10 flex size-[31px] shrink-0 items-center justify-center rounded-full border border-line bg-bg [&>svg]:size-3.5',
          tone === 'success' && 'border-success/30 bg-success/10 text-success',
          tone === 'danger' && 'border-danger/30 bg-danger/10 text-danger',
          tone === 'merged' && 'border-merged/30 bg-merged/10 text-merged',
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {actor && (
          <a href={`/${actor.login}`} className="flex shrink-0 items-center gap-1.5 font-medium text-fg hover:underline">
            <Avatar src={actor.avatarUrl} size={16} />
            {actor.login}
          </a>
        )}
        {children}
        {at && (
          <span className="ml-1 shrink-0 text-subtle" title={fullDate(at)}>
            · {timeAgo(at)}
          </span>
        )}
      </div>
    </div>
  );
}
