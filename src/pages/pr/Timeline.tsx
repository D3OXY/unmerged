import type { ReactNode } from 'react';
import { Check, CircleDot, Eye, GitCommitHorizontal, GitMerge, GitPullRequestDraft, MessageSquare, Pencil, RotateCcw, Tag, Trash2, Upload, X } from 'lucide-react';
import type { Actor } from '@/github/types';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { fullDate, timeAgo } from '@/lib/time';
import { Avatar, Markdown, Pill } from '@/ui/primitives';
import { CheckIcon } from '@/ui/status';
import type { ReviewState, TimelineItem } from './query';

/** Activity feed: comments as cards, everything else as quiet one-liners on a rail. */
export function Timeline({ items, hiddenCount }: { items: TimelineItem[]; hiddenCount: number }) {
  return (
    <div className="relative">
      <div className="absolute top-2 bottom-2 left-[15px] w-px bg-line" />
      {hiddenCount > 0 && (
        <EventLine icon={<MessageSquare />}>
          {hiddenCount} earlier events aren't shown.
          <button type="button" onClick={openClassic} className="cursor-pointer text-accent hover:underline">
            View in classic
          </button>
        </EventLine>
      )}
      {items.map((item) => (
        <TimelineEntry key={item.id} item={item} />
      ))}
    </div>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  switch (item.__typename) {
    case 'IssueComment':
      return <CommentCard author={item.author} createdAt={item.createdAt} html={item.bodyHTML} />;
    case 'PullRequestReview':
      return <Review item={item} />;
    case 'PullRequestCommit': {
      const { commit } = item;
      const user = commit.author?.user;
      return (
        <EventLine icon={<GitCommitHorizontal />}>
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
        <EventLine icon={<GitMerge />} tone="merged" actor={item.actor} at={item.createdAt}>
          merged {item.commit && <code className="font-mono text-fg/90">{item.commit.abbreviatedOid}</code>} into{' '}
          <code className="font-mono text-fg/90">{item.mergeRefName}</code>
        </EventLine>
      );
    case 'ClosedEvent':
      return <EventLine icon={<X />} tone="danger" actor={item.actor} at={item.createdAt}>closed this</EventLine>;
    case 'ReopenedEvent':
      return <EventLine icon={<RotateCcw />} tone="success" actor={item.actor} at={item.createdAt}>reopened this</EventLine>;
    case 'HeadRefForcePushedEvent':
      return <EventLine icon={<Upload />} actor={item.actor} at={item.createdAt}>force-pushed the branch</EventLine>;
    case 'HeadRefDeletedEvent':
      return <EventLine icon={<Trash2 />} actor={item.actor} at={item.createdAt}>deleted the branch</EventLine>;
    case 'ReadyForReviewEvent':
      return <EventLine icon={<Eye />} actor={item.actor} at={item.createdAt}>marked this ready for review</EventLine>;
    case 'ConvertToDraftEvent':
      return <EventLine icon={<GitPullRequestDraft />} actor={item.actor} at={item.createdAt}>converted this to a draft</EventLine>;
    case 'LabeledEvent':
      return (
        <EventLine icon={<Tag />} actor={item.actor} at={item.createdAt}>
          added <Pill color={item.label.color}>{item.label.name}</Pill>
        </EventLine>
      );
    case 'RenamedTitleEvent':
      return (
        <EventLine icon={<Pencil />} actor={item.actor} at={item.createdAt}>
          renamed from <span className="text-fg/80 line-through decoration-subtle">{item.previousTitle}</span>
        </EventLine>
      );
    case 'ReviewRequestedEvent': {
      const who = item.requestedReviewer?.login ?? item.requestedReviewer?.name;
      return (
        <EventLine icon={<Eye />} actor={item.actor} at={item.createdAt}>
          requested review{who && <> from <span className="font-medium text-fg/90">{who}</span></>}
        </EventLine>
      );
    }
  }
}

const REVIEW_COPY: Record<ReviewState, { verb: string; icon: ReactNode; tone?: 'success' | 'danger' }> = {
  APPROVED: { verb: 'approved these changes', icon: <Check />, tone: 'success' },
  CHANGES_REQUESTED: { verb: 'requested changes', icon: <CircleDot />, tone: 'danger' },
  COMMENTED: { verb: 'reviewed', icon: <Eye /> },
  DISMISSED: { verb: 'left a dismissed review', icon: <Eye /> },
  PENDING: { verb: 'started a review', icon: <Eye /> },
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

export function CommentCard({ author, createdAt, html, nested }: { author: Actor; createdAt: string; html: string; nested?: boolean }) {
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
          <div className="px-4 py-3">{html ? <Markdown html={html} /> : <span className="text-subtle italic">No description provided.</span>}</div>
        </div>
      </div>
    </div>
  );
}

function EventLine({
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
