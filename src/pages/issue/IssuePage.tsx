import { useEffect, useMemo } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { BrowserIcon, Link02Icon, MilestoneIcon, UnavailableIcon, UndoIcon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { emitNavigate } from '@/lib/navigation';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { repoPath } from '@/pages/pr/query';
import { CommentCard } from '@/pages/pr/Timeline';
import { usePrMutation } from '@/pages/pr/usePrMutation';
import { RepoFrame } from '@/pages/repo/RepoFrame';
import { Button } from '@/ui/Button';
import { Avatar, Skeleton } from '@/ui/primitives';
import { IssueIcon } from '@/ui/status';
import { CLOSE_REASONS, IssueComposer } from './IssueComposer';
import { SubIssuesCard } from './IssueRelations';
import { IssueSidebar } from './IssueSidebar';
import { IssueTimeline, RefLink } from './IssueTimeline';
import { issueKey, issueQuery, issueTimelineQuery, notPlanned, stateChange, type Issue, type IssueTimelineItems } from './query';

type Props = { owner: string; repo: string; number: number };

/** An issue (`/owner/repo/issues/<n>`) under the repo's header and tabs: description, activity and a sidebar. */
export function IssuePage({ owner, repo, number }: Props) {
  const { data } = useQuery(issueQuery(owner, repo, number));
  const subject = data?.repository?.issueOrPullRequest;
  useTitle(subject?.__typename === 'Issue' ? `${subject.title} · Issue #${number} · ${owner}/${repo}` : undefined);

  // GitHub redirects a pull request's /issues/<n> to its /pull/<n>; do the same, in place of this entry.
  const pullUrl = subject?.__typename === 'PullRequest' ? subject.url : undefined;
  useEffect(() => {
    if (!pullUrl) return;
    history.replaceState(null, '', pullUrl);
    emitNavigate(new URL(pullUrl));
  }, [pullUrl]);

  return (
    <RepoFrame owner={owner} name={repo} view="issues" item={`#${number}`}>
      <IssueContent owner={owner} repo={repo} number={number} />
    </RepoFrame>
  );
}

/**
 * The issue without the repo's frame: on its own page, and beside a list (`panel`), where the details sit in a
 * row under the title instead of a sidebar.
 */
export function IssueContent({ owner, repo, number, panel }: Props & { panel?: boolean }) {
  const { data, error } = useQuery(issueQuery(owner, repo, number));
  const timeline = useQuery(issueTimelineQuery(owner, repo, number));
  const subject = data?.repository?.issueOrPullRequest;
  if (subject?.__typename === 'Issue') {
    return <IssueView issue={subject} timeline={timeline.data ?? undefined} timelineFailed={timeline.isError} queryKey={issueKey(owner, repo, number)} panel={panel} />;
  }
  if (!error && !(data && !subject)) return <IssueSkeleton />;
  return (
    <div className="py-4 text-[13px]">
      <p className="text-danger">{error?.message ?? 'Issue not found.'}</p>
      <Button className="mt-4" onClick={openClassic}>
        Open in classic GitHub
      </Button>
    </div>
  );
}

/** Shows the issue at once; the timeline fills in when it loads. */
function IssueView({ issue, timeline, timelineFailed, queryKey, panel }: {
  issue: Issue;
  timeline?: IssueTimelineItems;
  timelineFailed: boolean;
  queryKey: QueryKey;
  panel?: boolean;
}) {
  const { mutate } = usePrMutation(queryKey);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'issue:copy-link', group: 'Issue', title: 'Copy link', icon: <HugeiconsIcon icon={Link02Icon} />, perform: () => copy(issue.url, 'link') },
      { id: 'issue:classic', group: 'Issue', title: 'Open in classic GitHub', icon: <HugeiconsIcon icon={BrowserIcon} />, perform: openClassic },
    ];
    if (issue.state === 'OPEN' && issue.viewerCanClose) {
      list.unshift(
        ...CLOSE_REASONS.map((reason): Command => ({
          id: `issue:close-${reason.value}`,
          group: 'Issue',
          title: reason.label,
          icon: <IssueIcon state="CLOSED" stateReason={reason.value} />,
          perform: () => mutate(stateChange(issue.id, reason.value)),
        })),
      );
    }
    if (issue.state === 'CLOSED' && issue.viewerCanReopen) {
      list.unshift({ id: 'issue:reopen', group: 'Issue', title: 'Reopen issue', icon: <HugeiconsIcon icon={UndoIcon} />, perform: () => mutate(stateChange(issue.id)) });
    }
    return list;
  }, [issue, mutate]);
  useRegisterCommands('issue', commands);

  const thread = (
    <div className="flex min-w-0 flex-col gap-6">
      <CommentCard author={issue.author} createdAt={issue.createdAt} html={issue.bodyHTML} />
      <SubIssuesCard issue={issue} queryKey={queryKey} />
      <IssueTimeline issue={issue} timeline={timeline} failed={timelineFailed} />
      <IssueComposer issue={issue} queryKey={queryKey} />
    </div>
  );

  return (
    <>
      <div className="max-w-[860px]">
        <h1 className={cx('leading-tight font-semibold tracking-tight', panel ? 'text-[20px]' : 'text-[24px]')}>
          <span data-private="titles">{issue.title}</span> <span className="font-normal text-subtle">#{issue.number}</span>
        </h1>
        {panel ? (
          <IssueDetails issue={issue} />
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] text-muted">
            <IssueStateBadge issue={issue} />
            {issue.author && (
              <a href={`/${issue.author.login}`} className="flex items-center gap-1.5 font-medium text-fg hover:underline">
                <Avatar src={issue.author.avatarUrl} size={18} />
                {issue.author.login}
              </a>
            )}
            <span>opened this {timeAgo(issue.createdAt)}</span>
          </div>
        )}
      </div>

      {panel ? (
        <div className="mt-6">{thread}</div>
      ) : (
        <div className="mt-6 grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
          {thread}
          <aside className="flex flex-col gap-4 *:shrink-0 @3xl:sticky @3xl:top-[108px] @3xl:max-h-[calc(100vh-124px)] @3xl:self-start @3xl:overflow-y-auto">
            <IssueSidebar issue={issue} queryKey={queryKey} />
          </aside>
        </div>
      )}
    </>
  );
}

const detail = 'inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-line px-2 text-[12px] text-fg';

/**
 * The sidebar's details as one row of chips under the title: state, assignees, labels, milestone, linked PRs,
 * parent and dependencies.
 */
function IssueDetails({ issue }: { issue: Issue }) {
  const { assignees, labels, milestone, parent, blockedBy, blocking } = issue;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <IssueStateBadge issue={issue} />
      {assignees.nodes.length > 0 && (
        <span className={detail} title="Assignees">
          {assignees.nodes.map((a) => (
            <Avatar key={a.login} src={a.avatarUrl} size={16} />
          ))}
          <span className="truncate">{assignees.nodes.map((a) => a.login).join(', ')}</span>
        </span>
      )}
      {labels.nodes.map((label) => (
        <span key={label.name} className={detail}>
          <span className="size-2 shrink-0 rounded-full" style={{ background: `#${label.color}` }} />
          <span className="truncate">{label.name}</span>
        </span>
      ))}
      {milestone && (
        <a href={milestone.url} className={cx(detail, 'hover:bg-hover')} title="Milestone">
          <HugeiconsIcon icon={MilestoneIcon} className="size-3.5 shrink-0 text-subtle" />
          <span className="truncate">{milestone.title}</span>
        </a>
      )}
      {issue.closedByPullRequestsReferences.nodes.map((pr) => (
        <span key={pr.url} className={cx(detail, 'hover:bg-hover')}>
          <RefLink subject={pr} here={repoPath(issue)} />
        </span>
      ))}
      {parent && (
        <span className={cx(detail, 'hover:bg-hover')} title="Parent issue">
          <span className="shrink-0 text-subtle">Parent</span>
          <RefLink subject={parent} here={repoPath(issue)} />
        </span>
      )}
      {blockedBy.totalCount > 0 && <Dependencies label="Blocked by" issues={blockedBy} />}
      {blocking.totalCount > 0 && <Dependencies label="Blocking" issues={blocking} />}
    </div>
  );
}

/** How many issues block this one, or it blocks; their numbers and titles in the tooltip. */
function Dependencies({ label, issues }: { label: string; issues: Issue['blockedBy'] }) {
  return (
    <span className={detail} title={issues.nodes.map((other) => `#${other.number} ${other.title}`).join('\n')}>
      <HugeiconsIcon icon={UnavailableIcon} className="size-3.5 shrink-0 text-subtle" />
      {label} {issues.totalCount}
    </span>
  );
}

/** Open (green), Closed as completed (purple) or Closed as not planned / duplicate (grey), like GitHub. */
function IssueStateBadge({ issue }: { issue: Issue }) {
  const tone =
    issue.state === 'OPEN'
      ? 'text-success bg-success/10 border-success/25'
      : notPlanned(issue.stateReason)
        ? 'text-muted bg-hover border-line'
        : 'text-merged bg-merged/10 border-merged/25';
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium', tone)}>
      <IssueIcon state={issue.state} stateReason={issue.stateReason} className="size-3.5 text-current" />
      {issue.state === 'OPEN' ? 'Open' : 'Closed'}
    </span>
  );
}

function IssueSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-[560px] max-w-full" />
      <Skeleton className="mt-4 h-5 w-[320px] max-w-full" />
      <div className="mt-8 grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </>
  );
}
