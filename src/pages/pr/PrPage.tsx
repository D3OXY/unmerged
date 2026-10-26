import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { BrowserIcon, Comment01Icon, ComputerTerminal01Icon, Copy01Icon, FileDiffIcon, GitCommitHorizontalIcon, GitPullRequestDraftIcon, Link02Icon, PencilEdit02Icon, TaskDone01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { gql } from '@/github/client';
import { PageHeader, Shell } from '@/app/Shell';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { navigate } from '@/lib/navigation';
import type { PrTab } from '@/lib/routes';
import { timeAgo } from '@/lib/time';
import { useDebounced } from '@/lib/useDebounced';
import { useTitle } from '@/lib/useTitle';
import { REFS_QUERY, type RefsData } from '@/pages/repo/query';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Avatar, Skeleton } from '@/ui/primitives';
import { CheckIcon, PrStateBadge } from '@/ui/status';
import { Tab, TabBar } from '@/ui/Tabs';
import { ChecksTab } from './ChecksTab';
import { CommitsTab } from './CommitsTab';
import { ConversationTab } from './ConversationTab';
import { FilesTab } from './files/FilesTab';
import {
  EDIT_MUTATIONS,
  isSettling,
  joinPr,
  MUTATIONS,
  prFilesQuery,
  prMergeQuery,
  prQuery,
  prReviewQuery,
  prStatusQuery,
  prTimelineQuery,
  prViewedQuery,
  repoPath,
  SLOW_POLL,
  type LoadedPr,
  type PrHead,
  type PrWithMerge,
} from './query';
import { SlideToMerge } from './SlideToMerge';
import { usePrMutation } from './usePrMutation';

type Props = { owner: string; repo: string; number: number; tab: PrTab };

/** Above this many changed files, other tabs don't download the patches in the background. */
const IDLE_PREFETCH_MAX_FILES = 300;

/** A pull request: shared header and tab bar over Conversation, Commits, Checks and Files changed. */
export function PrPage({ owner, repo, number, tab }: Props) {
  const shown = useQuery(prQuery(owner, repo, number)).data?.repository;
  const pr = shown?.pullRequest;
  useTitle(pr && `${pr.title} · Pull Request #${number} · ${owner}/${repo}`);
  const base = `/${owner}/${repo}`;
  const crumbs = [
    { label: owner, href: `/${owner}` },
    { label: <span data-private="repos">{repo}</span>, href: base },
    { label: 'Pull requests', href: `${base}/pulls` },
    { label: `#${number}` },
  ];

  return (
    <Shell privateRepo={shown?.isPrivate !== false}>
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
  const head = useQuery(query);
  const merge = useQuery(prMergeQuery(owner, repo, number));
  const review = useQuery(prReviewQuery(owner, repo, number));
  const timeline = useQuery(prTimelineQuery(owner, repo, number));
  const error = head.error ?? merge.error ?? review.error ?? timeline.error;
  // Each part's data keeps its identity until it changes, so the joined objects do too.
  const loaded = useMemo(() => joinPr(head.data, merge.data, review.data, timeline.data), [head.data, merge.data, review.data, timeline.data]);
  const pr = loaded?.pr;

  // While the reader is on another tab, get Files changed ready: the diff renderer, the viewed marks, and
  // (unless there are too many) the files themselves and the grammars for their languages.
  const queryClient = useQueryClient();
  const headRefOid = pr?.headRefOid;
  const changedFiles = pr?.changedFiles;
  useEffect(() => {
    if (!headRefOid || changedFiles === undefined) return;
    const id = requestIdleCallback(() => {
      queryClient.prefetchQuery(prViewedQuery(owner, repo, number));
      const files = changedFiles > IDLE_PREFETCH_MAX_FILES ? [] : queryClient.fetchQuery(prFilesQuery(owner, repo, { number, headRefOid, changedFiles }));
      Promise.all([loadDiffs(), files])
        .then(([renderer, list]) => renderer.preloadHighlighting(list.map((f) => f.filename)))
        .catch(() => {});
    });
    return () => cancelIdleCallback(id);
  }, [queryClient, owner, repo, number, headRefOid, changedFiles]);

  const poll = useStatusPoll(owner, repo, number, loaded?.merge?.pr);

  if (error || loaded === null) {
    return (
      <div className="p-10 text-[13px]">
        <p className="text-danger">{error?.message ?? 'Pull request not found.'}</p>
        <Button className="mt-4" onClick={openClassic}>
          Open in classic GitHub
        </Button>
      </div>
    );
  }
  if (!loaded) return <PrSkeleton />;
  const { full } = loaded;
  return (
    <>
      <PrView loaded={loaded} tab={tab} queryKey={queryKey} poll={poll} panel={panel} />
      {/* Outside PrView: its entry animation's transform would pin the fixed slider to the page, not the window. */}
      {full && <SlideToMerge pr={full.pr} repo={full.repo} queryKey={queryKey} />}
    </>
  );
}

type StatusPoll = ReturnType<typeof useStatusPoll>;

/**
 * Keeps an open PR's checks, mergeability and queue spot live: polls the small status query (which writes
 * into the merge part) while GitHub is still deciding. `watch()` polls for a minute regardless, because a re-run
 * GitHub hasn't queued yet still looks finished. While the Checks tab polls (`setChecksPolling`), this poll
 * pauses: the tab's answer is newer. After two minutes of polling, both polls slow down (`slow`).
 */
function useStatusPoll(owner: string, repo: string, number: number, pr: PrWithMerge | undefined) {
  const queryClient = useQueryClient();
  const status = prStatusQuery(owner, repo, number);
  const [watchedAt, setWatchedAt] = useState<number>();
  useEffect(() => {
    if (watchedAt === undefined) return;
    const id = setTimeout(() => setWatchedAt(undefined), 60_000);
    return () => clearTimeout(id);
  }, [watchedAt]);
  const watching = watchedAt !== undefined;
  const [checksPolling, setChecksPolling] = useState(false);
  const settling = !!pr && (watching || isSettling(pr));
  const polling = settling || checksPolling;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!polling) return;
    const id = setTimeout(() => setSlow(true), 2 * 60_000);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [polling]);
  useQuery({ ...status, enabled: settling && !checksPolling, refetchInterval: slow ? SLOW_POLL : 10_000 });
  const watch = () => {
    setWatchedAt(Date.now());
    queryClient.invalidateQueries(status);
  };
  return { watching, watch, slow, setChecksPolling };
}

/**
 * The header and the open tab. The first part is enough for the header, Commits, Checks and Files changed;
 * Conversation fills in each other part as it lands, and Approve waits for `full`.
 */
function PrView({ loaded, tab, queryKey, poll, panel }: {
  loaded: LoadedPr;
  tab: PrTab;
  queryKey: QueryKey;
  poll: StatusPoll;
  panel?: boolean;
}) {
  const approve = usePrMutation(queryKey);
  const draft = usePrMutation(queryKey);
  const { pr, full } = loaded;
  const total = pr.additions + pr.deletions || 1;
  const fullPr = full?.pr;

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
    if (fullPr && fullPr.state === 'OPEN' && !fullPr.viewerDidAuthor) {
      list.unshift({
        id: 'pr:approve',
        group: 'Pull request',
        title: 'Approve',
        icon: <HugeiconsIcon icon={Tick02Icon} />,
        // Like the composer: a pending review goes out with the approval.
        perform: () => {
          const pending = fullPr.viewerPendingReview?.nodes[0];
          approve.mutate({
            query: pending ? MUTATIONS.submitReview : MUTATIONS.addReview,
            variables: { id: pending?.id ?? fullPr.id, event: 'APPROVE' },
            success: 'Approved',
            nextAfter: fullPr.url,
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
  }, [pr, fullPr]);
  useRegisterCommands('pr', commands);

  // The merge part's checks are the ones the status poll keeps current.
  const rollup = (loaded.merge?.pr ?? pr).commits.nodes[0]?.commit.statusCheckRollup;

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
          {pr.state === 'OPEN' && pr.viewerCanUpdate && <BaseBranchMenu pr={pr} queryKey={queryKey} />}
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

      {tab === 'conversation' && <ConversationTab loaded={loaded} queryKey={queryKey} />}
      {tab === 'commits' && <CommitsTab pr={pr} />}
      {tab === 'checks' && <ChecksTab pr={pr} watching={poll.watching} slow={poll.slow} onRerun={poll.watch} onPolling={poll.setChecksPolling} />}
      {tab === 'files' && <FilesTab pr={pr} full={full?.pr} queryKey={queryKey} panel={panel} />}
    </div>
  );
}

/** The title, edited in place by whoever can update the PR. Enter saves, Esc cancels. */
function PrTitle({ pr, queryKey }: { pr: PrHead; queryKey: QueryKey }) {
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

/** Moves the pull request onto another base branch of its repository, after a confirm, as GitHub's title "Edit" does. */
function BaseBranchMenu({ pr, queryKey }: { pr: PrHead; queryKey: QueryKey }) {
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 200);
  const [owner, name] = repoPath(pr).split('/');
  const branches = useQuery({
    queryKey: ['repo-refs', owner, name, q],
    queryFn: () => gql<RefsData>(REFS_QUERY, { owner, name, q: q || null }),
    enabled: opened,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const change = usePrMutation(queryKey);
  // The head branch can't be its own base.
  const options = (branches.data?.repository?.branches.nodes ?? [])
    .filter((b) => b.name !== pr.headRefName || pr.isCrossRepository)
    .map((b) => ({ value: b.name, label: b.name }));
  return (
    <Menu<string>
      align="left"
      value={pr.baseRefName}
      options={options}
      onChange={(base) => {
        if (base !== pr.baseRefName && confirm(`Change the base branch to ${base}? The commits and changes of this pull request are then compared with ${base}.`)) {
          change.mutate({ query: EDIT_MUTATIONS.updateBase, variables: { id: pr.id, base }, success: `Base branch changed to ${base}` });
        }
      }}
      header={
        <div className="p-1 pb-1.5">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a branch"
            className="h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[12.5px] outline-none focus:border-accent/60"
          />
          {options.length === 0 && <p className="px-1.5 pt-2 text-[12px] text-subtle">{branches.isFetching ? 'Searching…' : 'No branches'}</p>}
        </div>
      }
      trigger={(open) => (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Change base branch"
          title="Change base branch"
          loading={change.isPending}
          icon={<HugeiconsIcon icon={PencilEdit02Icon} className="size-3.5" />}
          onClick={() => {
            setOpened(true);
            open();
          }}
          className="-ml-1.5 size-6"
        />
      )}
    />
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
      <TabSkeleton className="mt-8" />
    </div>
  );
}

function TabSkeleton({ className }: { className?: string }) {
  return (
    <div className={cx('grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]', className)}>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
