import { useEffect, useMemo } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { Check, Copy, FileDiff, GitCommitHorizontal, GitPullRequestDraft, Link2, ListChecks, MessageSquare, PanelsTopLeft, Terminal } from 'lucide-react';
import { gql } from '@/github/client';
import { useRegisterCommands, type Command } from '@/app/commands';
import { PageHeader, Shell } from '@/app/Shell';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { navigate } from '@/lib/navigation';
import type { PrTab } from '@/lib/routes';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Skeleton } from '@/ui/primitives';
import { CheckIcon, PrStateBadge } from '@/ui/status';
import { Tab, TabBar } from '@/ui/Tabs';
import { summarizeChecks } from './checks';
import { ChecksTab } from './ChecksTab';
import { CommitsTab } from './CommitsTab';
import { ConversationTab } from './ConversationTab';
import { FilesTab } from './files/FilesTab';
import { MUTATIONS, PR_QUERY, type PrData, type PullRequest, type Repo } from './query';
import { usePrMutation } from './usePrMutation';

type Props = { owner: string; repo: string; number: number; tab: PrTab };

/** A pull request: shared header and tab bar over Conversation, Commits, Checks and Files changed. */
export function PrPage({ owner, repo, number, tab }: Props) {
  const queryKey = useMemo(() => ['pr', owner.toLowerCase(), repo.toLowerCase(), number], [owner, repo, number]);
  // Warm up the diff renderer while the reader is on another tab, so Files changed opens without waiting.
  useEffect(() => {
    const id = requestIdleCallback(() => loadDiffs().catch(() => {}));
    return () => cancelIdleCallback(id);
  }, []);
  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => gql<PrData>(PR_QUERY, { owner, repo, number }, true),
    // Poll while GitHub is still deciding something (checks, mergeability, queue).
    refetchInterval: (query) => {
      const pr = query.state.data?.repository?.pullRequest;
      if (!pr || pr.state !== 'OPEN') return false;
      const pending = summarizeChecks(pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []).PENDING > 0;
      return pending || pr.mergeable === 'UNKNOWN' || pr.isInMergeQueue ? 10_000 : false;
    },
  });

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
            <Button size="sm" variant="ghost" icon={<Terminal className="size-3.5" />} onClick={() => copy(`gh pr checkout ${pr.number}`, 'checkout command')}>
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
      { id: 'pr:conversation', group: 'Pull request', title: 'Conversation', icon: <MessageSquare />, perform: () => navigate(pr.url) },
      { id: 'pr:files', group: 'Pull request', title: 'Files changed', icon: <FileDiff />, perform: () => navigate(`${pr.url}/files`) },
      { id: 'pr:commits', group: 'Pull request', title: 'Commits', icon: <GitCommitHorizontal />, perform: () => navigate(`${pr.url}/commits`) },
      { id: 'pr:checks', group: 'Pull request', title: 'Checks', icon: <ListChecks />, perform: () => navigate(`${pr.url}/checks`) },
      { id: 'pr:copy-branch', group: 'Pull request', title: 'Copy branch name', icon: <Copy />, hint: pr.headRefName, perform: () => copy(pr.headRefName, 'branch name') },
      { id: 'pr:copy-checkout', group: 'Pull request', title: 'Copy checkout command', icon: <Terminal />, perform: () => copy(`gh pr checkout ${pr.number}`, 'checkout command') },
      { id: 'pr:copy-link', group: 'Pull request', title: 'Copy link', icon: <Link2 />, perform: () => copy(pr.url, 'link') },
      { id: 'pr:classic', group: 'Pull request', title: 'Open in classic GitHub', icon: <PanelsTopLeft />, perform: openClassic },
    ];
    if (pr.state === 'OPEN' && !pr.viewerDidAuthor) {
      list.unshift({
        id: 'pr:approve',
        group: 'Pull request',
        title: 'Approve',
        icon: <Check />,
        perform: () => approve.mutate({ query: MUTATIONS.addReview, variables: { id: pr.id, event: 'APPROVE' }, success: 'Approved' }),
      });
    }
    if (pr.state === 'OPEN' && pr.viewerCanUpdate && !pr.isDraft) {
      list.push({
        id: 'pr:draft',
        group: 'Pull request',
        title: 'Convert to draft',
        icon: <GitPullRequestDraft />,
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
        <Tab href={pr.url} active={tab === 'conversation'} icon={<MessageSquare />} label="Conversation" />
        <Tab href={`${pr.url}/commits`} active={tab === 'commits'} icon={<GitCommitHorizontal />} label="Commits" count={pr.commits.totalCount} />
        <Tab
          href={`${pr.url}/checks`}
          active={tab === 'checks'}
          icon={rollup ? <CheckIcon state={rollup.state} /> : <ListChecks />}
          label="Checks"
          count={rollup?.contexts.nodes.length}
        />
        <Tab href={`${pr.url}/files`} active={tab === 'files'} icon={<FileDiff />} label="Files changed" count={pr.changedFiles} />
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
