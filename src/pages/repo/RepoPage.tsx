import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, BookOpen, CircleDot, Code2, Copy, Eye, EyeOff, FileSearch, GitBranch, GitFork, GitPullRequest, Lock, MessagesSquare, Play,
  Settings, Star, Tag, TrendingUp,
} from 'lucide-react';
import { gql } from '@/github/client';
import { useRegisterCommands, type Command } from '@/app/commands';
import { usePageHotkey } from '@/app/keyboard';
import { PageHeader, Shell } from '@/app/Shell';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { formatCount } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Avatar, Kbd, Panel, Pill } from '@/ui/primitives';
import { Tab, TabBar } from '@/ui/Tabs';
import { toast } from '@/ui/toast';
import { BlobView } from './BlobView';
import { BranchPicker } from './BranchPicker';
import { CloneMenu } from './CloneMenu';
import { FileFinder } from './FileFinder';
import { CONTENT_QUERY, REPO_MUTATIONS, REPO_QUERY, resolveRefPath, type ContentData, type Repo, type Subscription } from './query';
import { RepoSidebar } from './RepoSidebar';
import { TreeSkeleton, TreeView } from './TreeView';
import { treeUrl } from './urls';

type Props = { owner: string; repo: string; rest: string[] };

/** A repository: header and tabs over a code browser (root with sidebar, folders, files). */
export function RepoPage({ owner, repo: name, rest }: Props) {
  const metaKey = ['repo', owner.toLowerCase(), name.toLowerCase()];
  const meta = useQuery({ queryKey: metaKey, queryFn: () => gql<{ repository: Repo | null }>(REPO_QUERY, { owner, name }, true) });
  const repo = meta.data?.repository;

  // "<ref>/<path…>" → ref + path. Root URLs use the default branch.
  const resolved = useQuery({
    queryKey: ['repo-resolve', owner.toLowerCase(), name.toLowerCase(), rest.join('/')],
    queryFn: () => resolveRefPath(owner, name, rest),
    enabled: rest.length > 0,
    staleTime: Infinity,
  });
  const target = rest.length ? resolved.data : repo?.defaultBranchRef ? { ref: repo.defaultBranchRef.name, path: '' } : undefined;

  const content = useQuery({
    queryKey: ['repo-content', owner.toLowerCase(), name.toLowerCase(), target?.ref, target?.path],
    queryFn: () => gql<ContentData>(CONTENT_QUERY, { owner, name, expr: `${target!.ref}:${target!.path}`, ref: target!.ref, path: target!.path || null }),
    enabled: !!target,
    staleTime: 60_000,
  });

  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  useTitle(target?.path ? `${target.path.split('/').pop()} at ${target.ref} · ${nwo}` : nwo);

  const crumbs = [{ label: owner, href: `/${owner}` }, { label: name, href: `/${owner}/${name}` }];

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

  const object = content.data?.repository?.object;
  const history = content.data?.repository?.commit?.history;
  const notFound = (rest.length > 0 && resolved.data === null) || (content.data && !object);

  return (
    <Shell>
      <PageHeader crumbs={crumbs} actions={repo && <RepoActions repo={repo} queryKey={metaKey} />} />
      <div className="mx-auto max-w-[1240px] animate-enter px-6 pt-8 pb-24">
        {repo ? <RepoHeader repo={repo} /> : <div className="h-[34px]" />}
        <RepoTabs repo={repo ?? undefined} nwo={nwo} />

        {repo?.isEmpty ? (
          <Panel className="p-8 text-[13px] text-muted">
            This repository is empty. Clone it with <code className="font-mono text-fg">gh repo clone {nwo}</code> and push your first commit.
          </Panel>
        ) : notFound ? (
          <Panel className="p-8 text-[13px]">
            <p className="text-danger">That branch, tag or path doesn't exist.</p>
            <Button className="mt-4" onClick={() => navigate(`/${nwo}`)}>
              Back to the default branch
            </Button>
          </Panel>
        ) : (
          <>
            {repo && target && <Toolbar repo={repo} gitRef={target.ref} path={target.path} />}
            {!object || !target || !repo ? (
              <TreeSkeleton />
            ) : object.__typename === 'Blob' ? (
              <BlobView nameWithOwner={nwo} gitRef={target.ref} path={target.path} blob={object} lastCommit={history?.nodes[0]} />
            ) : target.path ? (
              <TreeView nameWithOwner={nwo} gitRef={target.ref} path={target.path} entries={object.entries} lastCommit={history?.nodes[0]} commitCount={history?.totalCount} />
            ) : (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_296px]">
                <TreeView nameWithOwner={nwo} gitRef={target.ref} path="" entries={object.entries} lastCommit={history?.nodes[0]} commitCount={history?.totalCount} />
                <RepoSidebar repo={repo} />
              </div>
            )}
          </>
        )}
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
        {repo.isPrivate && <Lock className="size-3" />}
        {repo.isPrivate ? 'Private' : 'Public'}
      </Pill>
      {repo.isArchived && (
        <Pill className="border-warning/30 text-warning">
          <Archive className="size-3" /> Archived
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

/** Code is ours; the other tabs link to GitHub's pages. Optional tabs stay hidden until the repo loads. */
function RepoTabs({ repo, nwo }: { repo?: Repo; nwo: string }) {
  const tabs: { label: string; href: string; icon: ReactNode; count?: number; show?: boolean }[] = [
    { label: 'Code', href: `/${nwo}`, icon: <Code2 /> },
    { label: 'Issues', href: `/${nwo}/issues`, icon: <CircleDot />, count: repo?.issues.totalCount, show: !!repo?.hasIssuesEnabled },
    { label: 'Pull requests', href: `/${nwo}/pulls`, icon: <GitPullRequest />, count: repo?.pullRequests.totalCount },
    { label: 'Discussions', href: `/${nwo}/discussions`, icon: <MessagesSquare />, show: !!repo?.hasDiscussionsEnabled },
    { label: 'Actions', href: `/${nwo}/actions`, icon: <Play /> },
    { label: 'Wiki', href: `/${nwo}/wiki`, icon: <BookOpen />, show: !!repo?.hasWikiEnabled },
    { label: 'Insights', href: `/${nwo}/pulse`, icon: <TrendingUp /> },
    { label: 'Settings', href: `/${nwo}/settings`, icon: <Settings />, show: !!repo?.viewerCanAdminister },
  ];
  return (
    <TabBar className="mt-5 mb-6">
      {tabs
        .filter((t) => t.show !== false)
        .map((tab, i) => (
          <Tab key={tab.label} href={tab.href} active={i === 0} icon={tab.icon} label={tab.label} count={tab.count || undefined} />
        ))}
    </TabBar>
  );
}

function Toolbar({ repo, gitRef, path }: { repo: Repo; gitRef: string; path: string }) {
  const [owner, name] = repo.nameWithOwner.split('/') as [string, string];
  const [finding, setFinding] = useState(false);
  const segments = path ? path.split('/') : [];
  const openFinder = useCallback(() => setFinding(true), []);
  usePageHotkey('t', openFinder);

  const commands = useMemo<Command[]>(
    () => [
      { id: 'repo:find', group: 'Repository', title: 'Go to file…', hint: 'T', icon: <FileSearch />, perform: openFinder },
      { id: 'repo:clone-https', group: 'Repository', title: 'Copy HTTPS clone URL', icon: <Copy />, perform: () => copy(`${repo.url}.git`, 'clone URL') },
      { id: 'repo:clone-ssh', group: 'Repository', title: 'Copy SSH clone URL', icon: <Copy />, perform: () => copy(repo.sshUrl, 'clone URL') },
      { id: 'repo:clone-gh', group: 'Repository', title: 'Copy gh repo clone', icon: <Copy />, perform: () => copy(`gh repo clone ${repo.nameWithOwner}`, 'clone command') },
      { id: 'repo:issues', group: 'Repository', title: 'Issues', icon: <CircleDot />, perform: () => navigate(`/${repo.nameWithOwner}/issues`) },
      { id: 'repo:pulls', group: 'Repository', title: 'Pull requests', icon: <GitPullRequest />, perform: () => navigate(`/${repo.nameWithOwner}/pulls`) },
      { id: 'repo:actions', group: 'Repository', title: 'Actions', icon: <Play />, perform: () => navigate(`/${repo.nameWithOwner}/actions`) },
    ],
    [repo, openFinder],
  );
  useRegisterCommands('repo', commands);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <BranchPicker owner={owner} name={name} current={gitRef} path={path} />
      {!path && (
        <span className="hidden items-center gap-3 px-2 text-[12.5px] text-muted sm:flex">
          <a href={`/${repo.nameWithOwner}/branches`} className="flex items-center gap-1.5 hover:text-fg">
            <GitBranch className="size-3.5 text-subtle" />
            <b className="font-medium text-fg">{repo.branches.totalCount}</b> branches
          </a>
          <a href={`/${repo.nameWithOwner}/tags`} className="flex items-center gap-1.5 hover:text-fg">
            <Tag className="size-3.5 text-subtle" />
            <b className="font-medium text-fg">{repo.tags.totalCount}</b> tags
          </a>
        </span>
      )}
      {segments.length > 0 && (
        <div className="flex min-w-0 items-center gap-1 px-1 font-mono text-[12.5px]">
          <a href={treeUrl(repo.nameWithOwner, gitRef)} className="font-medium text-accent hover:underline">
            {repo.name}
          </a>
          {segments.map((segment, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1">
              <span className="text-subtle">/</span>
              {i === segments.length - 1 ? (
                <span className="truncate font-medium">{segment}</span>
              ) : (
                <a href={treeUrl(repo.nameWithOwner, gitRef, segments.slice(0, i + 1).join('/'))} className="truncate text-accent hover:underline">
                  {segment}
                </a>
              )}
            </span>
          ))}
          <button type="button" onClick={() => copy(path, 'path')} title="Copy path" className="ml-1 flex size-6 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
            <Copy className="size-3" />
          </button>
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={openFinder}
          className="flex h-8 w-52 cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] text-subtle hover:border-line-strong hover:text-muted"
        >
          <FileSearch className="size-3.5" />
          Go to file
          <Kbd className="ml-auto">T</Kbd>
        </button>
        <CloneMenu repo={repo} gitRef={gitRef} />
      </div>
      {finding && <FileFinder nameWithOwner={repo.nameWithOwner} gitRef={gitRef} onClose={() => setFinding(false)} />}
    </div>
  );
}

const WATCH_LABEL: Record<Subscription, string> = { UNSUBSCRIBED: 'Watch', SUBSCRIBED: 'Watching', IGNORED: 'Ignoring' };

/** Watch / Star / Fork, with optimistic counts. */
function RepoActions({ repo, queryKey }: { repo: Repo; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const patch = (changes: Partial<Repo>) => queryClient.setQueryData<{ repository: Repo }>(queryKey, (d) => d && { repository: { ...d.repository, ...changes } });
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

  return (
    <>
      <Menu<Subscription>
        value={subscription}
        options={[
          { value: 'UNSUBSCRIBED', label: 'Participating and @mentions', hint: 'Only when you take part or are mentioned' },
          { value: 'SUBSCRIBED', label: 'All activity', hint: 'Every issue, pull request and release' },
          { value: 'IGNORED', label: 'Ignore', hint: 'Never be notified' },
        ]}
        onChange={(state) => watch.mutate(state)}
        trigger={(open) => (
          <Button size="sm" variant="ghost" icon={subscription === 'IGNORED' ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} onClick={open}>
            {WATCH_LABEL[subscription]}
            <span className="text-subtle tabular-nums">{formatCount(repo.watchers.totalCount)}</span>
          </Button>
        )}
      />
      <Button size="sm" variant="ghost" icon={<GitFork className="size-3.5" />} onClick={() => location.assign(`/${repo.nameWithOwner}/fork`)}>
        Fork
        <span className="text-subtle tabular-nums">{formatCount(repo.forkCount)}</span>
      </Button>
      <Button
        size="sm"
        variant={repo.viewerHasStarred ? 'secondary' : 'ghost'}
        icon={<Star className={cx('size-3.5', repo.viewerHasStarred && 'fill-warning text-warning')} />}
        onClick={() => star.mutate(repo.viewerHasStarred)}
      >
        {repo.viewerHasStarred ? 'Starred' : 'Star'}
        <span className="text-subtle tabular-nums">{formatCount(repo.stargazerCount)}</span>
      </Button>
    </>
  );
}
