import { useState, type ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon, CircleDotIcon, Comment01Icon, Delete02Icon, FlashIcon, FlashOffIcon, GitBranchIcon, GitCommitHorizontalIcon, GitMergeIcon,
  GitPullRequestDraftIcon, Link02Icon, SquareLock01Icon, MilestoneIcon, MoreHorizontalIcon, PencilEdit02Icon, Rocket01Icon, Tag01Icon, Tick02Icon,
  UndoIcon, Unlink02Icon, SquareUnlock01Icon, Upload01Icon, UserAdd01Icon, UserRemove01Icon, ViewIcon, ViewOffIcon,
} from '@hugeicons/core-free-icons';
import type { Actor } from '@/github/types';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { fullDate, timeAgo } from '@/lib/time';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Avatar, Markdown, Pill } from '@/ui/primitives';
import { CheckIcon, IssueIcon, PrStateIcon } from '@/ui/status';
import { CommentBody, type Editable } from './CommentBody';
import { LOCK_REASON, quoteReply } from './Composer';
import { EDIT_MUTATIONS, type AuthorAssociation, type CommentMeta, type HideReason, type Reference, type ReviewState, type TimelineItem } from './query';
import { usePrMutation } from './usePrMutation';

/** Activity feed: comments as cards, everything else as quiet one-liners on a rail. */
export function Timeline({ items, hiddenCount, queryKey, pr }: { items: TimelineItem[]; hiddenCount: number; queryKey: QueryKey; pr: { id: string; author: Actor } }) {
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
        <TimelineEntry key={item.id} item={item} queryKey={queryKey} pr={pr} />
      ))}
    </div>
  );
}

function TimelineEntry({ item, queryKey, pr }: { item: TimelineItem; queryKey: QueryKey; pr: { id: string; author: Actor } }) {
  switch (item.__typename) {
    case 'IssueComment':
      return (
        <CommentCard
          author={item.author}
          createdAt={item.createdAt}
          html={item.bodyHTML}
          editable={{ kind: 'comment', node: item, queryKey }}
          meta={item}
          prAuthor={pr.author?.login}
          onQuote={() => quoteReply(pr.id, item.body)}
        />
      );
    case 'PullRequestReview':
      return <Review item={item} prAuthor={pr.author?.login} />;
    case 'PullRequestCommit': {
      const { commit } = item;
      const user = commit.author?.user;
      return (
        <EventLine icon={<HugeiconsIcon icon={GitCommitHorizontalIcon} />}>
          <a href={commit.url} className="flex min-w-0 items-center gap-2 hover:text-fg">
            {user && <Avatar src={user.avatarUrl} size={16} />}
            <span data-private="commits" className="truncate text-fg/90">
              {commit.messageHeadline}
            </span>
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
    case 'BaseRefChangedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={GitBranchIcon} />} actor={item.actor} at={item.createdAt}>
          changed the base branch from <code className="font-mono text-fg/90">{item.previousRefName}</code> to{' '}
          <code className="font-mono text-fg/90">{item.currentRefName}</code>
        </EventLine>
      );
    case 'ReviewRequestRemovedEvent': {
      const who = item.requestedReviewer?.login ?? item.requestedReviewer?.name;
      return (
        <EventLine icon={<HugeiconsIcon icon={ViewOffIcon} />} actor={item.actor} at={item.createdAt}>
          removed the review request{who && <> for <span className="font-medium text-fg/90">{who}</span></>}
        </EventLine>
      );
    }
    case 'HeadRefRestoredEvent':
      return <EventLine icon={<HugeiconsIcon icon={UndoIcon} />} actor={item.actor} at={item.createdAt}>restored the branch</EventLine>;
    case 'MilestonedEvent':
    case 'DemilestonedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={MilestoneIcon} />} actor={item.actor} at={item.createdAt}>
          {item.__typename === 'MilestonedEvent' ? 'added this to the' : 'removed this from the'}{' '}
          <span className="truncate font-medium text-fg/90">{item.milestoneTitle}</span> milestone
        </EventLine>
      );
    case 'LockedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={SquareLock01Icon} />} actor={item.actor} at={item.createdAt}>
          locked {item.lockReason ? `as ${LOCK_REASON[item.lockReason]}` : 'the conversation'}
        </EventLine>
      );
    case 'UnlockedEvent':
      return <EventLine icon={<HugeiconsIcon icon={SquareUnlock01Icon} />} actor={item.actor} at={item.createdAt}>unlocked the conversation</EventLine>;
    case 'AddedToMergeQueueEvent':
      return <EventLine icon={<HugeiconsIcon icon={GitMergeIcon} />} actor={item.actor} at={item.createdAt}>added this to the merge queue</EventLine>;
    case 'RemovedFromMergeQueueEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={GitMergeIcon} />} actor={item.actor} at={item.createdAt}>
          <span className="shrink-0">removed this from the merge queue</span>
          {item.reason && <span className="min-w-0 truncate text-subtle" title={item.reason}>: {item.reason}</span>}
        </EventLine>
      );
    case 'ReferencedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={GitCommitHorizontalIcon} />} actor={item.actor} at={item.createdAt}>
          <span className="shrink-0">referenced this in</span>
          {item.commit ? (
            <a href={item.commit.url} className="flex min-w-0 items-center gap-1.5 hover:text-fg">
              <code className="font-mono text-fg/90">{item.commit.abbreviatedOid}</code>
              <span data-private="commits" className="truncate">{item.commit.messageHeadline}</span>
            </a>
          ) : (
            'a commit'
          )}
        </EventLine>
      );
    case 'DeployedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Rocket01Icon} />} actor={item.actor} at={item.createdAt}>
          deployed{item.deployment.environment && <> to <span className="font-medium text-fg/90">{item.deployment.environment}</span></>}
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

function Review({ item, prAuthor }: { item: Extract<TimelineItem, { __typename: 'PullRequestReview' }>; prAuthor?: string }) {
  const copy = REVIEW_COPY[item.state];
  const at = item.submittedAt ?? item.createdAt;
  return (
    <>
      <EventLine icon={copy.icon} tone={copy.tone} actor={item.author} at={at}>
        {copy.verb}
      </EventLine>
      {item.bodyHTML && <CommentCard author={item.author} createdAt={at} html={item.bodyHTML} meta={item} prAuthor={prAuthor} nested />}
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

/**
 * A comment in a card. `editable` adds reactions and, where allowed, edit and delete. `meta` adds the author's
 * role, an "edited" mark and a menu (copy link, `onQuote`, hide); a hidden comment stays folded until opened.
 */
export function CommentCard({ author, createdAt, html, nested, editable, meta, prAuthor, onQuote }: {
  author: Actor;
  createdAt: string;
  html: string;
  nested?: boolean;
  editable?: Editable;
  meta?: Partial<CommentMeta>;
  /** The pull request's author, whose comments say "Author". */
  prAuthor?: string;
  onQuote?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const folded = !!meta?.isMinimized && !revealed;
  return (
    <div className={cx('relative py-2.5', nested ? 'pl-10' : 'pl-0')}>
      <div className="flex gap-3">
        {!nested && <Avatar src={author?.avatarUrl} size={32} className="relative z-10 ring-4 ring-bg" />}
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-panel">
          <div className={cx('flex h-9 items-center gap-2 px-4 text-[12.5px]', !folded && 'border-b border-line')}>
            {author && (
              <a href={`/${author.login}`} className="font-semibold hover:underline">
                {author.login}
              </a>
            )}
            <span className="text-subtle" title={fullDate(createdAt)}>
              {timeAgo(createdAt)}
            </span>
            {meta?.lastEditedAt && (
              <span className="text-subtle" title={`Edited ${fullDate(meta.lastEditedAt)}`}>
                · edited
              </span>
            )}
            <span className="ml-auto flex items-center gap-1.5">
              <CommentBadges association={meta?.authorAssociation} isPrAuthor={!!prAuthor && author?.login === prAuthor} />
              {meta && <CommentMenu meta={meta} subjectId={editable?.node.id} queryKey={editable?.queryKey} onQuote={onQuote} />}
            </span>
          </div>
          {meta?.isMinimized && (
            <HiddenNote reason={meta.minimizedReason ?? null} revealed={revealed} onToggle={() => setRevealed((r) => !r)} className="border-t border-line bg-hover/50 px-4 py-2" />
          )}
          {!folded && (
            <div className="px-4 py-3">
              {editable ? <CommentBody html={html} {...editable} /> : html ? <Markdown html={html} /> : <span className="text-subtle italic">No description provided.</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** "This comment was hidden as off-topic", with a toggle that shows or folds it again. */
export function HiddenNote({ reason, revealed, onToggle, className }: { reason: string | null; revealed: boolean; onToggle: () => void; className?: string }) {
  return (
    <div className={cx('flex items-center gap-2 text-[12px] text-muted', className)}>
      <HugeiconsIcon icon={ViewOffIcon} className="size-3.5 shrink-0" />
      This comment was hidden{reason && ` as ${reason.toLowerCase().replace(/[-_]/g, ' ')}`}.
      <button type="button" onClick={onToggle} className="cursor-pointer text-accent hover:underline">
        {revealed ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

const ROLE: Partial<Record<AuthorAssociation, string>> = {
  OWNER: 'Owner',
  MEMBER: 'Member',
  COLLABORATOR: 'Collaborator',
  CONTRIBUTOR: 'Contributor',
  FIRST_TIME_CONTRIBUTOR: 'First-time contributor',
  FIRST_TIMER: 'First-time contributor',
};

/** The comment author's role in the repository, and "Author" for the pull request's author, as GitHub labels them. */
export function CommentBadges({ association, isPrAuthor }: { association?: AuthorAssociation; isPrAuthor: boolean }) {
  const role = association && ROLE[association];
  return (
    <>
      {isPrAuthor && <Pill className="h-[18px] text-[10.5px] text-muted">Author</Pill>}
      {role && <Pill className="h-[18px] text-[10.5px] text-muted">{role}</Pill>}
    </>
  );
}

const HIDE_REASONS: [HideReason, string][] = [
  ['OUTDATED', 'Outdated'],
  ['RESOLVED', 'Resolved'],
  ['DUPLICATE', 'Duplicate'],
  ['OFF_TOPIC', 'Off-topic'],
  ['SPAM', 'Spam'],
  ['ABUSE', 'Abuse'],
];

type MenuAction = 'copy' | 'quote' | 'unhide' | `hide:${HideReason}`;

/** A comment's "…" menu: copy its link, quote it in a reply (`onQuote`), and hide or unhide it where GitHub allows. */
export function CommentMenu({ meta, subjectId, queryKey, onQuote }: { meta: Partial<CommentMeta>; subjectId?: string; queryKey?: QueryKey; onQuote?: () => void }) {
  // Hiding needs both; without them the mutation never runs.
  const hide = usePrMutation(queryKey ?? []);
  const canHide = !!subjectId && !!queryKey;
  const options: MenuOption<MenuAction>[] = [
    ...(meta.url ? [{ value: 'copy' as const, label: 'Copy link' }] : []),
    ...(onQuote ? [{ value: 'quote' as const, label: 'Quote reply' }] : []),
    ...(canHide && meta.isMinimized && meta.viewerCanUnminimize ? [{ value: 'unhide' as const, label: 'Unhide' }] : []),
    ...(canHide && !meta.isMinimized && meta.viewerCanMinimize
      ? HIDE_REASONS.map(([reason, label]): MenuOption<MenuAction> => ({ value: `hide:${reason}`, label: `Hide as ${label.toLowerCase()}` }))
      : []),
  ];
  if (!options.length) return null;
  const act = (action: MenuAction) => {
    if (action === 'copy' && meta.url) copy(meta.url, 'link');
    else if (action === 'quote') onQuote?.();
    else if (action === 'unhide') hide.mutate({ query: EDIT_MUTATIONS.unhideComment, variables: { id: subjectId }, success: 'Comment shown' });
    else if (action.startsWith('hide:')) hide.mutate({ query: EDIT_MUTATIONS.hideComment, variables: { id: subjectId, reason: action.slice(5) }, success: 'Comment hidden' });
  };
  return (
    <Menu<MenuAction>
      value={null}
      options={options}
      onChange={act}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          aria-label="Comment actions"
          title="Comment actions"
          className="flex size-6 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
        </button>
      )}
    />
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
