import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Comment01Icon,
  HierarchyIcon,
  Link02Icon,
  PencilEdit02Icon,
  Tag01Icon,
  UnavailableIcon,
  UndoIcon,
  Unlink02Icon,
  UserAdd01Icon,
  UserRemove01Icon,
} from '@hugeicons/core-free-icons';
import type { IssueStateReason } from '@/github/types';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { repoPath } from '@/pages/pr/query';
import { CommentCard, EventLine } from '@/pages/pr/Timeline';
import { Pill } from '@/ui/primitives';
import { IssueIcon, PrStateIcon } from '@/ui/status';
import { mergeTimeline, notPlanned, type Issue, type IssueTimelineItem, type IssueTimelineItems, type Ref, type RelationEvent } from './query';

/**
 * The issue's activity on the PR timeline's rail: comments as cards, everything else as one-liners. Until
 * `timeline` loads, only the issue's newest comments show, under a line that says the rest is loading.
 */
export function IssueTimeline({ issue, timeline, failed }: { issue: Issue; timeline?: IssueTimelineItems; failed: boolean }) {
  const { items, hidden } = mergeTimeline(issue.comments.nodes, timeline);
  const here = repoPath(issue);
  const classic = (
    <button type="button" onClick={openClassic} className="cursor-pointer text-accent hover:underline">
      View in classic
    </button>
  );
  return (
    <div className="relative">
      <div className="absolute top-2 bottom-2 left-[15px] w-px bg-line" />
      {hidden === undefined ? (
        <EventLine icon={<HugeiconsIcon icon={Comment01Icon} />}>
          {failed ? <>Earlier activity didn't load. {classic}</> : 'Loading earlier activity…'}
        </EventLine>
      ) : (
        hidden > 0 && (
          <EventLine icon={<HugeiconsIcon icon={Comment01Icon} />}>
            {hidden} earlier events aren't shown. {classic}
          </EventLine>
        )
      )}
      {items.map((item) => (
        <Entry key={item.id} item={item} issueUrl={issue.url} here={here} />
      ))}
    </div>
  );
}

const CLOSED_AS: Partial<Record<IssueStateReason, string>> = { COMPLETED: ' as completed', NOT_PLANNED: ' as not planned', DUPLICATE: ' as a duplicate' };

function Entry({ item, issueUrl, here }: { item: IssueTimelineItem; issueUrl: string; here: string }) {
  switch (item.__typename) {
    case 'IssueComment':
      return <CommentCard author={item.author} createdAt={item.createdAt} html={item.bodyHTML} />;
    case 'ClosedEvent': {
      const planned = !notPlanned(item.stateReason);
      const { closer } = item;
      const via =
        closer?.__typename === 'PullRequest' ? { url: closer.url, label: `#${closer.number}` } : closer?.__typename === 'Commit' ? { url: closer.url, label: closer.abbreviatedOid } : null;
      return (
        <EventLine icon={<HugeiconsIcon icon={planned ? CheckmarkCircle02Icon : UnavailableIcon} />} tone={planned ? 'merged' : undefined} actor={item.actor} at={item.createdAt}>
          closed this{item.stateReason && CLOSED_AS[item.stateReason]}
          {via && (
            <>
              in
              <a href={via.url} className="font-medium text-fg/90 hover:underline">
                {via.label}
              </a>
            </>
          )}
        </EventLine>
      );
    }
    case 'ReopenedEvent':
      return <EventLine icon={<HugeiconsIcon icon={UndoIcon} />} tone="success" actor={item.actor} at={item.createdAt}>reopened this</EventLine>;
    case 'LabeledEvent':
    case 'UnlabeledEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Tag01Icon} />} actor={item.actor} at={item.createdAt}>
          {item.__typename === 'LabeledEvent' ? 'added' : 'removed'} <Pill color={item.label.color}>{item.label.name}</Pill>
        </EventLine>
      );
    case 'AssignedEvent':
    case 'UnassignedEvent': {
      const assigned = item.__typename === 'AssignedEvent';
      const who = item.assignee?.login;
      return (
        <EventLine icon={<HugeiconsIcon icon={assigned ? UserAdd01Icon : UserRemove01Icon} />} actor={item.actor} at={item.createdAt}>
          {who && who === item.actor?.login ? (
            assigned ? 'self-assigned this' : 'removed their assignment'
          ) : (
            <>
              {assigned ? 'assigned' : 'unassigned'} {who && <span className="font-medium text-fg/90">{who}</span>}
            </>
          )}
        </EventLine>
      );
    }
    case 'CrossReferencedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={Link02Icon} />} actor={item.actor} at={item.createdAt}>
          <span className="shrink-0">mentioned this in</span>
          <RefLink subject={item.source} here={here} />
        </EventLine>
      );
    case 'RenamedTitleEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={PencilEdit02Icon} />} actor={item.actor} at={item.createdAt}>
          renamed from <span className="text-fg/80 line-through decoration-subtle">{item.previousTitle}</span>
        </EventLine>
      );
    case 'ConnectedEvent':
    case 'DisconnectedEvent':
      return (
        <EventLine icon={<HugeiconsIcon icon={item.__typename === 'ConnectedEvent' ? Link02Icon : Unlink02Icon} />} actor={item.actor} at={item.createdAt}>
          <span className="shrink-0">{item.__typename === 'ConnectedEvent' ? 'linked' : 'unlinked'}</span>
          <RefLink subject={item.source.url === issueUrl ? item.subject : item.source} here={here} />
        </EventLine>
      );
    default: {
      const [verb, icon] = RELATION_EVENTS[item.__typename];
      return (
        <EventLine icon={<HugeiconsIcon icon={icon} />} actor={item.actor} at={item.createdAt}>
          <span className="shrink-0">{verb}</span>
          {item.issue ? <RefLink subject={item.issue} here={here} /> : <span className="text-subtle">an issue you can't see</span>}
        </EventLine>
      );
    }
  }
}

const RELATION_EVENTS: Record<RelationEvent, [verb: string, icon: IconSvgElement]> = {
  ParentIssueAddedEvent: ['added parent issue', HierarchyIcon],
  ParentIssueRemovedEvent: ['removed parent issue', HierarchyIcon],
  SubIssueAddedEvent: ['added sub-issue', HierarchyIcon],
  SubIssueRemovedEvent: ['removed sub-issue', HierarchyIcon],
  BlockedByAddedEvent: ['marked this as blocked by', UnavailableIcon],
  BlockedByRemovedEvent: ['removed blocked by', UnavailableIcon],
  BlockingAddedEvent: ['marked this as blocking', UnavailableIcon],
  BlockingRemovedEvent: ['removed blocking', UnavailableIcon],
};

/** Another issue or pull request: state icon, title and number (with its repo when it's elsewhere). */
export function RefLink({ subject, here, className }: { subject: Ref; here: string; className?: string }) {
  const repo = subject.repository.nameWithOwner;
  return (
    <a href={subject.url} title={subject.title} className={cx('flex min-w-0 items-center gap-1.5 text-fg/90 hover:text-fg', className)}>
      {subject.__typename === 'Issue' ? (
        <IssueIcon state={subject.state} stateReason={subject.stateReason} className="size-3.5" />
      ) : (
        <PrStateIcon state={subject.state} isDraft={subject.isDraft} className="size-3.5" />
      )}
      <span className="truncate">{subject.title}</span>
      <span className="shrink-0 text-subtle">
        {repo.toLowerCase() === here.toLowerCase() ? '' : repo}#{subject.number}
      </span>
    </a>
  );
}
