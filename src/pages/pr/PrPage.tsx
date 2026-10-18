import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { BrowserIcon, Comment01Icon, ComputerTerminal01Icon, Copy01Icon, FileDiffIcon, GitCommitHorizontalIcon, GitPullRequestDraftIcon, Link02Icon, PencilEdit02Icon, TaskDone01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { PageHeader, Shell } from '@/app/Shell';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
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
import { EDIT_MUTATIONS, isSettling, MUTATIONS, prFilesQuery, prQuery, prStatusQuery, prViewedQuery, type PullRequest, type Repo } from './query';
import { SlideToMerge } from './SlideToMerge';
import { usePrMutation } from './usePrMutation';

type Props = { owner: string; repo: string; number: number; tab: PrTab };

/** Above this many changed files, other tabs don't download the patches in the background. */
const IDLE_PREFETCH_MAX_FILES = 300;

/** A pull request: shared header and tab bar over Conversation, Commits, Checks and Files changed. */
export function PrPage({ owner, repo, number, tab }: Props) {
  const { data } = useQuery(prQuery(owner, repo, number));
  const pr = data?.repository?.pullRequest;
  useTitle(pr && `${pr.title} · Pull Request #${number} · ${owner}/${repo}`);
  const base = `/${owner}/${repo}`;
  const crumbs = [
    { label: owner, href: `/${owner}` },
    { label: <span data-private="repos">{repo}</span>, href: base },
    { label: 'Pull requests', href: `${base}/pulls` },
    { label: `#${number}` },
  ];

  return (
    <Shell privateRepo={data?.repository?.isPrivate !== false}>
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
      <PrContent owner={owner} repo={repo} number={number} tab={tab} />
    </Shell>
  );
}

/**
 * The pull request without the page's frame: on its own page and in a list's side panel (`panel`), where its
 * tabs switch the panel instead of leaving the list.
 */
export function PrContent({ owner, repo, number, tab, panel }: Props & { panel?: boolean }) {
  const query = prQuery(owner, repo, number);
  const { queryKey } = query;
  const { data, isPending, error } = useQuery(query);
  const pr = data?.repository?.pullRequest;

  // While the reader is on another tab, get Files changed ready: the diff renderer, the viewed marks, and
  // (unless there are too many) the files themselves and the grammars for their languages.
  const queryClient = useQueryClient();
  const dark = useIsDark();
  const headRefOid = pr?.headRefOid;
  const changedFiles = pr?.changedFiles;
  useEffect(() => {
    if (!headRefOid || changedFiles === undefined) return;
    const id = requestIdleCallback(() => {
      queryClient.prefetchQuery(prViewedQuery(owner, repo, number));
      const files = changedFiles > IDLE_PREFETCH_MAX_FILES ? [] : queryClient.fetchQuery(prFilesQuery(owner, repo, { number, headRefOid, changedFiles }));
      Promise.all([loadDiffs(), files])
        .then(([renderer, list]) => renderer.preloadHighlighting(list.map((f) => f.filename), dark))
        .catch(() => {});
    });
    return () => cancelIdleCallback(id);
  }, [queryClient, owner, repo, number, headRefOid, changedFiles, dark]);

  const poll = useStatusPoll(owner, repo, number, pr);

  if (error || (data && !pr)) {
    return (
      <div className="p-10 text-[13px]">
        <p className="text-danger">{error?.message ?? 'Pull request not found.'}</p>
        <Button className="mt-4" onClick={openClassic}>
          Open in classic GitHub
        </Button>
      </div>
    );
  }
  if (isPending || !pr || !data.repository) return <PrSkeleton />;
  return (
    <>
      <PrView pr={pr} repo={data.repository} tab={tab} queryKey={queryKey} poll={poll} panel={panel} />
      {/* Outside PrView: its entry animation's transform would pin the fixed slider to the page, not the window. */}
      <SlideToMerge pr={pr} repo={data.repository} queryKey={queryKey} />
    </>
  );
}

type StatusPoll = ReturnType<typeof useStatusPoll>;

/**
 * Keeps an open PR's checks, mergeability and queue spot live: polls the small status query (which writes
 * into the full PR) while GitHub is still deciding. `watch()` polls for a minute regardless, because a re-run
 * GitHub hasn't queued yet still looks finished.
 */
function useStatusPoll(owner: string, repo: string, number: number, pr: PullRequest | null | undefined) {
  const queryClient = useQueryClient();
  const status = prStatusQuery(owner, repo, number);
  const [watchedAt, setWatchedAt] = useState<number>();
  useEffect(() => {
    if (watchedAt === undefined) return;
    const id = setTimeout(() => setWatchedAt(undefined), 60_000);
    return () => clearTimeout(id);
  }, [watchedAt]);
  const watching = watchedAt !== undefined;
  useQuery({ ...status, enabled: !!pr && (watching || isSettling(pr)), refetchInterval: 10_000 });
  const watch = () => {
    setWatchedAt(Date.now());
    queryClient.invalidateQueries(status);
  };
  return { watching, watch };
}

function PrView({ pr, repo, tab, queryKey, poll, panel }: { pr: PullRequest; repo: Repo; tab: PrTab; queryKey: QueryKey; poll: StatusPoll; panel?: boolean }) {
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
        // Like the composer: a pending review goes out with the approval.
        perform: () => {
          const pending = pr.viewerPendingReview?.nodes[0];
          approve.mutate({
            query: pending ? MUTATIONS.submitReview : MUTATIONS.addReview,
            variables: { id: pending?.id ?? pr.id, event: 'APPROVE' },
            success: 'Approved',
            nextAfter: pr.url,
          });
        },
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
    <div className="mx-auto max-w-[1600px] animate-enter px-6 pt-8 pb-8">
      <div className="max-w-[860px]">
        <PrTitle pr={pr} queryKey={queryKey} />
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
        <Tab href={pr.url} peek={panel} active={tab === 'conversation'} icon={<HugeiconsIcon icon={Comment01Icon} />} label="Conversation" />
        <Tab href={`${pr.url}/commits`} peek={panel} active={tab === 'commits'} icon={<HugeiconsIcon icon={GitCommitHorizontalIcon} />} label="Commits" count={pr.commits.totalCount} />
        <Tab
          href={`${pr.url}/checks`}
          peek={panel}
          active={tab === 'checks'}
          icon={rollup ? <CheckIcon state={rollup.state} /> : <HugeiconsIcon icon={TaskDone01Icon} />}
          label="Checks"
          count={rollup?.contexts.nodes.length}
        />
        <Tab href={`${pr.url}/files`} peek={panel} active={tab === 'files'} icon={<HugeiconsIcon icon={FileDiffIcon} />} label="Files changed" count={pr.changedFiles} />
      </TabBar>

      {tab === 'conversation' && <ConversationTab pr={pr} repo={repo} queryKey={queryKey} />}
      {tab === 'commits' && <CommitsTab pr={pr} />}
      {tab === 'checks' && <ChecksTab pr={pr} watching={poll.watching} onRerun={poll.watch} />}
      {tab === 'files' && <FilesTab pr={pr} queryKey={queryKey} />}
    </div>
  );
}

/** The title, edited in place by whoever can update the PR. Enter saves, Esc cancels. */
function PrTitle({ pr, queryKey }: { pr: PullRequest; queryKey: QueryKey }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = usePrMutation(queryKey);

  if (draft === null) {
    return (
      <h1 className="group/title text-[24px] leading-tight font-semibold tracking-tight">
        <span data-private="titles">{pr.title}</span> <span className="font-normal text-subtle">#{pr.number}</span>
        {pr.viewerCanUpdate && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Edit title"
            title="Edit title"
            icon={<HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />}
            onClick={() => setDraft(pr.title)}
            className="ml-1 align-middle opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100"
          />
        )}
      </h1>
    );
  }

  const title = draft.trim();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title === pr.title) return setDraft(null);
        save.mutate({ query: EDIT_MUTATIONS.updateTitle, variables: { id: pr.id, title } }, { onSuccess: () => setDraft(null) });
      }}
    >
      <input
        autoFocus
        aria-label="Title"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-[20px] font-semibold tracking-tight outline-none focus:border-accent/60"
      />
      <Button type="submit" variant="primary" disabled={!title} loading={save.isPending}>
        Save
      </Button>
      <Button variant="ghost" onClick={() => setDraft(null)}>
        Cancel
      </Button>
    </form>
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
    <div className="mx-auto max-w-[1600px] px-6 pt-8">
      <Skeleton className="h-8 w-[560px] max-w-full" />
      <Skeleton className="mt-4 h-5 w-[420px] max-w-full" />
      <div className="mt-8 grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
