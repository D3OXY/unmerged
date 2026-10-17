import { useEffect, useMemo } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { BrowserIcon, Link02Icon, UndoIcon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { emitNavigate } from '@/lib/navigation';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { CommentCard } from '@/pages/pr/Timeline';
import { usePrMutation } from '@/pages/pr/usePrMutation';
import { RepoFrame } from '@/pages/repo/RepoFrame';
import { Button } from '@/ui/Button';
import { Avatar, Skeleton } from '@/ui/primitives';
import { IssueIcon } from '@/ui/status';
import { CLOSE_REASONS, IssueComposer } from './IssueComposer';
import { IssueSidebar } from './IssueSidebar';
import { IssueTimeline } from './IssueTimeline';
import { issueQuery, notPlanned, stateChange, type Issue } from './query';

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

/** The issue without the repo's frame: on its own page and in a list's side panel. */
export function IssueContent({ owner, repo, number }: Props) {
  const query = issueQuery(owner, repo, number);
  const { data, error } = useQuery(query);
  const subject = data?.repository?.issueOrPullRequest;
  if (subject?.__typename === 'Issue') return <IssueView issue={subject} queryKey={query.queryKey} />;
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

function IssueView({ issue, queryKey }: { issue: Issue; queryKey: QueryKey }) {
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

  return (
    <>
      <div className="max-w-[860px]">
        <h1 className="text-[24px] leading-tight font-semibold tracking-tight">
          {issue.title} <span className="font-normal text-subtle">#{issue.number}</span>
        </h1>
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
      </div>

      <div className="mt-6 grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <CommentCard author={issue.author} createdAt={issue.createdAt} html={issue.bodyHTML} />
          <IssueTimeline issue={issue} />
          <IssueComposer issue={issue} queryKey={queryKey} />
        </div>
        <aside className="flex flex-col gap-4 *:shrink-0 @3xl:sticky @3xl:top-[108px] @3xl:max-h-[calc(100vh-124px)] @3xl:self-start @3xl:overflow-y-auto">
          <IssueSidebar issue={issue} />
        </aside>
      </div>
    </>
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
