import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { BrowserIcon, Comment01Icon, ComputerTerminal01Icon, Copy01Icon, FileDiffIcon, GitCommitHorizontalIcon, GitPullRequestDraftIcon, Link02Icon, TaskDone01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { PageHeader, Shell } from '@/app/Shell';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { useIsDark } from '@/lib/settings';
import { navigate } from '@/lib/navigation';
import type { PrTab } from '@/lib/routes';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Skeleton } from '@/ui/primitives';
import { CheckIcon, PrStateBadge } from '@/ui/status';
import { Tab, TabBar } from '@/ui/Tabs';
import { ChecksTab } from './ChecksTab';
import { CommitsTab } from './CommitsTab';
import { ConversationTab } from './ConversationTab';
import { FilesTab } from './files/FilesTab';
import { MUTATIONS, prefetchPr, prFilesQuery, prQuery, type PullRequest, type Repo } from './query';
import { usePrMutation } from './usePrMutation';

type Props = { owner: string; repo: string; number: number; tab: PrTab };

/** A pull request: shared header and tab bar over Conversation, Commits, Checks and Files changed. */
export function PrPage({ owner, repo, number, tab }: Props) {
  const query = prQuery(owner, repo, number);
  const { queryKey } = query;
  // While the reader is on another tab, get Files changed ready: the diff renderer, the files themselves,
  // and the grammars for their languages.
  const queryClient = useQueryClient();
  const dark = useIsDark();
  useEffect(() => {
    const id = requestIdleCallback(() => {
      prefetchPr(queryClient, owner, repo, number, 'files');
      Promise.all([loadDiffs(), queryClient.fetchQuery(prFilesQuery(owner, repo, number))])
        .then(([renderer, files]) => renderer.preloadHighlighting(files.map((f) => f.filename), dark))
        .catch(() => {});
    });
    return () => cancelIdleCallback(id);
  }, [queryClient, owner, repo, number, dark]);
  const { data, isPending, error } = useQuery(query);

  const pr = data?.repository?.pullRequest;
  const base = `/${owner}/${repo}`;
  useTitle(pr && `${pr.title} · Pull Request #${number} · ${owner}/${repo}`);
  const crumbs = [
    { label: owner, href: `/${owner}` },
    { label: repo, href: base },
    { label: 'Pull requests', href: `${base}/pulls` },
    { label: `#${number}` },
  ];

  if (error || (data && !pr)) {
    return (
      <Shell>
        <PageHeader crumbs={crumbs} />
        <div className="p-10 text-[13px]">
          <p className="text-danger">{error?.message ?? 'Pull request not found.'}</p>
          <Button className="mt-4" onClick={openClassic}>
            Open in classic GitHub
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        crumbs={crumbs}
        actions={
          pr && (
            <Button size="sm" variant="ghost" icon={<HugeiconsIcon icon={ComputerTerminal01Icon} className="size-3.5" />} onClick={() => copy(`gh pr checkout ${pr.number}`, 'checkout command')}>
              Checkout
            </Button>
          )
        }
      />
      {isPending || !pr || !data.repository ? (
        <PrSkeleton />
      ) : (
        <PrView pr={pr} repo={data.repository} tab={tab} queryKey={queryKey} />
      )}
    </Shell>
  );
}

function PrView({ pr, repo, tab, queryKey }: { pr: PullRequest; repo: Repo; tab: PrTab; queryKey: QueryKey }) {
  const approve = usePrMutation(queryKey);
  const draft = usePrMutation(queryKey);
  const total = pr.additions + pr.deletions || 1;

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'pr:conversation', group: 'Pull request', title: 'Conversation', icon: <HugeiconsIcon icon={Comment01Icon} />, perform: () => navigate(pr.url) },
      { id: 'pr:files', group: 'Pull request', title: 'Files changed', icon: <HugeiconsIcon icon={FileDiffIcon} />, perform: () => navigate(`${pr.url}/files`) },
      { id: 'pr:commits', group: 'Pull request', title: 'Commits', icon: <HugeiconsIcon icon={GitCommitHorizontalIcon} />, perform: () => navigate(`${pr.url}/commits`) },
      { id: 'pr:checks', group: 'Pull request', title: 'Checks', icon: <HugeiconsIcon icon={TaskDone01Icon} />, perform: () => navigate(`${pr.url}/checks`) },
      { id: 'pr:copy-branch', group: 'Pull request', title: 'Copy branch name', icon: <HugeiconsIcon icon={Copy01Icon} />, hint: pr.headRefName, perform: () => copy(pr.headRefName, 'branch name') },
      { id: 'pr:copy-checkout', group: 'Pull request', title: 'Copy checkout command', icon: <HugeiconsIcon icon={ComputerTerminal01Icon} />, perform: () => copy(`gh pr checkout ${pr.number}`, 'checkout command') },
      { id: 'pr:copy-link', group: 'Pull request', title: 'Copy link', icon: <HugeiconsIcon icon={Link02Icon} />, perform: () => copy(pr.url, 'link') },
      { id: 'pr:classic', group: 'Pull request', title: 'Open in classic GitHub', icon: <HugeiconsIcon icon={BrowserIcon} />, perform: openClassic },
    ];
    if (pr.state === 'OPEN' && !pr.viewerDidAuthor) {
      list.unshift({
        id: 'pr:approve',
        group: 'Pull request',
        title: 'Approve',
        icon: <HugeiconsIcon icon={Tick02Icon} />,
        perform: () => approve.mutate({ query: MUTATIONS.addReview, variables: { id: pr.id, event: 'APPROVE' }, success: 'Approved' }),
      });
    }
    if (pr.state === 'OPEN' && pr.viewerCanUpdate && !pr.isDraft) {
      list.push({
        id: 'pr:draft',
        group: 'Pull request',
        title: 'Convert to draft',
        icon: <HugeiconsIcon icon={GitPullRequestDraftIcon} />,
        perform: () => draft.mutate({ query: MUTATIONS.convertToDraft, variables: { id: pr.id }, success: 'Converted to draft' }),
      });
    }
    return list;
    // Mutation objects change identity every render; their `mutate` is stable.
  }, [pr]);
  useRegisterCommands('pr', commands);

  const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup;

  return (
    <div className={cx('mx-auto animate-enter px-6 pt-8 pb-8', tab === 'files' ? 'max-w-[1600px]' : 'max-w-[1240px]')}>
      <div className="max-w-[860px]">
        <h1 className="text-[24px] leading-tight font-semibold tracking-tight">
          {pr.title} <span className="font-normal text-subtle">#{pr.number}</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] text-muted">
          <PrStateBadge state={pr.state} isDraft={pr.isDraft} />
          {pr.author && (
            <a href={`/${pr.author.login}`} className="flex items-center gap-1.5 font-medium text-fg hover:underline">
              <Avatar src={pr.author.avatarUrl} size={18} />
              {pr.author.login}
            </a>
          )}
          <span>
            {pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'wanted to merge' : 'wants to merge'} {pr.commits.totalCount} commit
            {pr.commits.totalCount === 1 ? '' : 's'} into
          </span>
          <BranchChip name={pr.baseRefName} />
          <span>from</span>
          <BranchChip name={pr.isCrossRepository && pr.headRepositoryOwner ? `${pr.headRepositoryOwner.login}:${pr.headRefName}` : pr.headRefName} />
          <span className="text-subtle">· {timeAgo(pr.createdAt)}</span>
        </div>
      </div>

      <TabBar
        className="mt-6 mb-6"
        trailing={
          <span className="flex items-center gap-3 text-[12px]">
            <span className="font-mono text-success tabular-nums">+{pr.additions.toLocaleString()}</span>
            <span className="font-mono text-danger tabular-nums">−{pr.deletions.toLocaleString()}</span>
            <span className="flex h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
              <span className="bg-success" style={{ width: `${(pr.additions / total) * 100}%` }} />
              <span className="bg-danger" style={{ width: `${(pr.deletions / total) * 100}%` }} />
            </span>
          </span>
        }
      >
        <Tab href={pr.url} active={tab === 'conversation'} icon={<HugeiconsIcon icon={Comment01Icon} />} label="Conversation" />
        <Tab href={`${pr.url}/commits`} active={tab === 'commits'} icon={<HugeiconsIcon icon={GitCommitHorizontalIcon} />} label="Commits" count={pr.commits.totalCount} />
        <Tab
          href={`${pr.url}/checks`}
          active={tab === 'checks'}
          icon={rollup ? <CheckIcon state={rollup.state} /> : <HugeiconsIcon icon={TaskDone01Icon} />}
          label="Checks"
          count={rollup?.contexts.nodes.length}
        />
        <Tab href={`${pr.url}/files`} active={tab === 'files'} icon={<HugeiconsIcon icon={FileDiffIcon} />} label="Files changed" count={pr.changedFiles} />
      </TabBar>

      {tab === 'conversation' && <ConversationTab pr={pr} repo={repo} queryKey={queryKey} />}
      {tab === 'commits' && <CommitsTab pr={pr} />}
      {tab === 'checks' && <ChecksTab pr={pr} />}
      {tab === 'files' && <FilesTab pr={pr} queryKey={queryKey} />}
    </div>
  );
}

function BranchChip({ name }: { name: string }) {
  return (
    <button
      type="button"
      title="Copy branch name"
      onClick={() => copy(name, 'branch name')}
      className="inline-flex h-6 max-w-[260px] cursor-pointer items-center truncate rounded-md border border-line bg-elevated px-2 font-mono text-[11.5px] text-fg/90 transition-colors hover:border-line-strong"
    >
      {name}
    </button>
  );
}

function PrSkeleton() {
  return (
    <div className="mx-auto max-w-[1240px] px-6 pt-8">
      <Skeleton className="h-8 w-[560px] max-w-full" />
      <Skeleton className="mt-4 h-5 w-[420px] max-w-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
