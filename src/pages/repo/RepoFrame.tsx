import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Analytics01Icon, Archive02Icon, BookOpen01Icon, CircleDotIcon, CodeIcon, GitForkIcon, GitPullRequestCreateIcon, GitPullRequestIcon, MessageMultiple02Icon, PinIcon, PinOffIcon, PlayIcon, PlusSignIcon, Settings02Icon, SquareLock02Icon, StarIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { gql } from '@/github/client';
import { PageHeader, Shell } from '@/app/Shell';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { pin, unpin, useIsPinned } from '@/lib/pins';
import type { RepoView } from '@/lib/routes';
import { formatCount } from '@/lib/time';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Avatar, Pill } from '@/ui/primitives';
import { Tab, TabBar } from '@/ui/Tabs';
import { toast } from '@/ui/toast';
import { REPO_MUTATIONS, repoQuery, type Repo, type Subscription } from './query';

/** The repo's metadata. Shared by the frame and the page inside it (one request). */
export const useRepo = (owner: string, name: string) => useQuery(repoQuery(owner, name));

const LIST_TITLES: Partial<Record<RepoView, string>> = { issues: 'Issues', pulls: 'Pull requests' };

/**
 * Frame for every repo view: breadcrumbs with Watch/Star/Fork, the repo's name, and tabs between views.
 * `item` is the last crumb of a page inside a list (an issue's "#12"); the list's crumb then links back.
 * `aside` goes to the shell's right (a list's side panel).
 */
export function RepoFrame({ owner, name, view, item, aside, children }: { owner: string; name: string; view: RepoView; item?: string; aside?: ReactNode; children: ReactNode }) {
  const meta = useRepo(owner, name);
  const repo = meta.data?.repository;
  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  const list = LIST_TITLES[view];
  const crumbs = [
    { label: owner, href: `/${owner}` },
    { label: name, href: `/${owner}/${name}` },
    ...(list ? [{ label: list, href: item && `/${owner}/${name}/${view}` }] : []),
    ...(item ? [{ label: item }] : []),
  ];

  if (meta.error || (meta.data && !repo)) {
    return (
      <Shell>
        <PageHeader crumbs={crumbs} />
        <div className="p-10 text-[13px]">
          <p className="text-danger">{meta.error?.message ?? "Repository not found, or your token can't see it."}</p>
          <Button className="mt-4" onClick={openClassic}>
            Open in classic GitHub
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell aside={aside}>
      <PageHeader crumbs={crumbs} actions={repo && <RepoActions repo={repo} queryKey={repoQuery(owner, name).queryKey} />} />
      <div className="mx-auto max-w-[1240px] animate-enter px-6 pt-8 pb-8">
        {repo ? <RepoHeader repo={repo} /> : <div className="h-[34px]" />}
        <RepoTabs repo={repo ?? undefined} nwo={nwo} view={view} />
        {children}
      </div>
    </Shell>
  );
}

function RepoHeader({ repo }: { repo: Repo }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar src={repo.owner.avatarUrl} size={34} square />
      <h1 className="text-[22px] font-semibold tracking-tight">
        <a href={`/${repo.owner.login}`} className="font-normal text-muted hover:text-fg">
          {repo.owner.login}
        </a>
        <span className="mx-1.5 font-normal text-subtle">/</span>
        {repo.name}
      </h1>
      <Pill>
        {repo.isPrivate && <HugeiconsIcon icon={SquareLock02Icon} className="size-3" />}
        {repo.isPrivate ? 'Private' : 'Public'}
      </Pill>
      {repo.isArchived && (
        <Pill className="border-warning/30 text-warning">
          <HugeiconsIcon icon={Archive02Icon} className="size-3" /> Archived
        </Pill>
      )}
      {repo.isTemplate && <Pill>Template</Pill>}
      {repo.parent && (
        <span className="text-[12.5px] text-subtle">
          forked from{' '}
          <a href={`/${repo.parent.nameWithOwner}`} className="text-muted hover:text-fg hover:underline">
            {repo.parent.nameWithOwner}
          </a>
        </span>
      )}
    </div>
  );
}

/**
 * Code (with commits under it), Issues and Pull requests are ours; the other tabs link to GitHub's pages.
 * Optional tabs stay hidden until the repo loads. The list views get a New issue link (Unmerged's page) or a
 * New pull request link (GitHub's compare page).
 */
function RepoTabs({ repo, nwo, view }: { repo?: Repo; nwo: string; view: RepoView }) {
  const tabs: { label: string; href: string; icon: ReactNode; views?: RepoView[]; count?: number; show?: boolean }[] = [
    { label: 'Code', href: `/${nwo}`, icon: <HugeiconsIcon icon={CodeIcon} />, views: ['code', 'commits'] },
    { label: 'Issues', href: `/${nwo}/issues`, icon: <HugeiconsIcon icon={CircleDotIcon} />, views: ['issues'], count: repo?.issues.totalCount, show: !!repo?.hasIssuesEnabled },
    { label: 'Pull requests', href: `/${nwo}/pulls`, icon: <HugeiconsIcon icon={GitPullRequestIcon} />, views: ['pulls'], count: repo?.pullRequests.totalCount },
    { label: 'Discussions', href: `/${nwo}/discussions`, icon: <HugeiconsIcon icon={MessageMultiple02Icon} />, show: !!repo?.hasDiscussionsEnabled },
    { label: 'Actions', href: `/${nwo}/actions`, icon: <HugeiconsIcon icon={PlayIcon} /> },
    { label: 'Wiki', href: `/${nwo}/wiki`, icon: <HugeiconsIcon icon={BookOpen01Icon} />, show: !!repo?.hasWikiEnabled },
    { label: 'Insights', href: `/${nwo}/pulse`, icon: <HugeiconsIcon icon={Analytics01Icon} /> },
    { label: 'Settings', href: `/${nwo}/settings`, icon: <HugeiconsIcon icon={Settings02Icon} />, show: !!repo?.viewerCanAdminister },
  ];
  const create =
    repo &&
    !repo.isArchived &&
    (view === 'issues'
      ? repo.hasIssuesEnabled && { label: 'New issue', href: `/${nwo}/issues/new`, icon: PlusSignIcon }
      : view === 'pulls' && { label: 'New pull request', href: `/${nwo}/compare`, icon: GitPullRequestCreateIcon });
  return (
    <TabBar
      className="mt-5 mb-6"
      trailing={
        create && (
          <a href={create.href} className="flex h-7 items-center gap-1.5 rounded-md bg-success px-2.5 text-[12px] font-medium text-white hover:brightness-110">
            <HugeiconsIcon icon={create.icon} className="size-3.5" />
            {create.label}
          </a>
        )
      }
    >
      {tabs
        .filter((t) => t.show !== false)
        .map((t) => (
          <Tab key={t.label} href={t.href} active={!!t.views?.includes(view)} icon={t.icon} label={t.label} count={t.count || undefined} />
        ))}
    </TabBar>
  );
}

const WATCH_LABEL: Record<Subscription, string> = { UNSUBSCRIBED: 'Watch', SUBSCRIBED: 'Watching', IGNORED: 'Ignoring' };

/** Pin / Watch / Fork / Star, with optimistic counts. Narrow (next to a side panel), only icons and counts. */
function RepoActions({ repo, queryKey }: { repo: Repo; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  // A refetch already in flight would land after the patch and flip it back, so it's cancelled first.
  const patch = async (changes: Partial<Repo>) => {
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<{ repository: Repo }>(queryKey, (d) => d && { repository: { ...d.repository, ...changes } });
  };
  const rollback = (error: Error) => {
    toast.error(error);
    return queryClient.invalidateQueries({ queryKey });
  };

  const star = useMutation({
    mutationFn: (starred: boolean) => gql(starred ? REPO_MUTATIONS.unstar : REPO_MUTATIONS.star, { id: repo.id }),
    onMutate: (starred) => patch({ viewerHasStarred: !starred, stargazerCount: repo.stargazerCount + (starred ? -1 : 1) }),
    onError: rollback,
  });
  const watch = useMutation({
    mutationFn: (state: Subscription) => gql(REPO_MUTATIONS.subscribe, { id: repo.id, state }),
    onMutate: (state) => patch({ viewerSubscription: state }),
    onError: rollback,
  });
  const subscription = repo.viewerSubscription ?? 'UNSUBSCRIBED';
  const pinned = useIsPinned(repo.nameWithOwner);

  return (
    <>
      <Button
        size="sm"
        variant={pinned ? 'secondary' : 'ghost'}
        icon={pinned ? <HugeiconsIcon icon={PinOffIcon} className="size-3.5" /> : <HugeiconsIcon icon={PinIcon} className="size-3.5" />}
        onClick={() => (pinned ? unpin(repo.nameWithOwner) : pin(repo.nameWithOwner))}
        title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
      >
        <span className="@max-3xl:hidden">{pinned ? 'Pinned' : 'Pin'}</span>
      </Button>
      <Menu<Subscription>
        value={subscription}
        options={[
          { value: 'UNSUBSCRIBED', label: 'Participating and @mentions', hint: 'Only when you take part or are mentioned' },
          { value: 'SUBSCRIBED', label: 'All activity', hint: 'Every issue, pull request and release' },
          { value: 'IGNORED', label: 'Ignore', hint: 'Never be notified' },
        ]}
        onChange={(state) => watch.mutate(state)}
        trigger={(open) => (
          <Button size="sm" variant="ghost" icon={subscription === 'IGNORED' ? <HugeiconsIcon icon={ViewOffSlashIcon} className="size-3.5" /> : <HugeiconsIcon icon={ViewIcon} className="size-3.5" />} onClick={open}>
            <span className="@max-3xl:hidden">{WATCH_LABEL[subscription]}</span>
            <span className="text-subtle tabular-nums">{formatCount(repo.watchers.totalCount)}</span>
          </Button>
        )}
      />
      <Button size="sm" variant="ghost" icon={<HugeiconsIcon icon={GitForkIcon} className="size-3.5" />} onClick={() => location.assign(`/${repo.nameWithOwner}/fork`)}>
        <span className="@max-3xl:hidden">Fork</span>
        <span className="text-subtle tabular-nums">{formatCount(repo.forkCount)}</span>
      </Button>
      <Button
        size="sm"
        variant={repo.viewerHasStarred ? 'secondary' : 'ghost'}
        icon={<HugeiconsIcon icon={StarIcon} className={cx('size-3.5', repo.viewerHasStarred && 'fill-warning text-warning')} />}
        onClick={() => star.mutate(repo.viewerHasStarred)}
      >
        <span className="@max-3xl:hidden">{repo.viewerHasStarred ? 'Starred' : 'Star'}</span>
        <span className="text-subtle tabular-nums">{formatCount(repo.stargazerCount)}</span>
      </Button>
    </>
  );
}
