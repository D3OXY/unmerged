import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { CircleDotIcon, Copy01Icon, FileSearchIcon, GitBranchIcon, GitPullRequestCreateIcon, GitPullRequestIcon, PinIcon, PinOffIcon, PlayIcon, PlusSignIcon, Tag01Icon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { usePageHotkey } from '@/app/keyboard';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { navigate } from '@/lib/navigation';
import { pin, unpin, useIsPinned } from '@/lib/pins';
import { useMedia } from '@/lib/useMedia';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Kbd, Panel } from '@/ui/primitives';
import { BlobView } from './BlobView';
import { BranchPicker } from './BranchPicker';
import { CloneMenu } from './CloneMenu';
import { CommitsView } from './CommitsView';
import { FileFinder } from './FileFinder';
import { DEFAULT_REVISION, repoContentQuery, repoResolveQuery, type Repo } from './query';
import { RecentPushes } from './RecentPushes';
import { RepoFrame, useRepo } from './RepoFrame';
import { RepoSidebar } from './RepoSidebar';
import { TreeSkeleton, TreeView } from './TreeView';
import { treeUrl } from './urls';

type Props = { owner: string; repo: string; view: 'code' | 'commits'; rest: string[] };

/** A repository's code browser (root with sidebar, folders, files) or its commit history. */
export function RepoPage({ owner, repo: name, view, rest }: Props) {
  // Warm up the code renderer (file highlighting) while idle, so opening a file doesn't wait for it.
  useEffect(() => {
    const id = requestIdleCallback(() => loadDiffs().catch(() => {}));
    return () => cancelIdleCallback(id);
  }, []);
  const repo = useRepo(owner, name).data?.repository;

  // "<ref>/<path…>" → ref + path. The root reads the default branch as HEAD, so it needn't wait for `repo`.
  const resolved = useQuery({ ...repoResolveQuery(owner, name, rest), enabled: rest.length > 0 });
  const revision = rest.length ? resolved.data : { ref: DEFAULT_REVISION, path: '' };
  const content = useQuery({ ...repoContentQuery(owner, name, revision?.ref ?? '', revision?.path ?? ''), enabled: !!revision && view === 'code' });
  // What links and the branch picker show: the branch's name rather than HEAD.
  const target = revision && (revision.ref === DEFAULT_REVISION ? repo?.defaultBranchRef && { ref: repo.defaultBranchRef.name, path: '' } : revision);

  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  useTitle(
    view === 'commits'
      ? `${target?.path ? `History for ${target.path}` : 'Commits'} · ${nwo}`
      : target?.path
        ? `${target.path.split('/').pop()} at ${target.ref} · ${nwo}`
        : nwo,
  );

  const object = content.data?.repository?.object;
  const commit = content.data?.repository?.commit;
  const history = commit?.history;
  // Waits for `repo`: an empty repository also has nothing at HEAD, and says so itself.
  const notFound = !!repo && ((rest.length > 0 && resolved.data === null) || (content.data && !object));

  return (
    <RepoFrame owner={owner} name={name} view={view}>
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
      ) : view === 'commits' ? (
        repo && target ? <CommitsView key={`${target.ref}:${target.path}`} repo={repo} gitRef={target.ref} path={target.path} /> : <TreeSkeleton />
      ) : (
        <>
          {repo && !rest.length && <RecentPushes repo={repo} />}
          {!repo || !target ? (
            <TreeSkeleton />
          ) : (
            <Toolbar repo={repo} gitRef={target.ref} path={target.path} aside={object?.__typename === 'Tree' && !target.path && <RepoSidebar repo={repo} />}>
              {!object ? (
                <TreeSkeleton />
              ) : object.__typename === 'Blob' ? (
                <BlobView nameWithOwner={nwo} gitRef={target.ref} path={target.path} blob={object} lastCommit={history?.nodes[0]} commitOid={commit?.oid} />
              ) : (
                <TreeView nameWithOwner={nwo} gitRef={target.ref} revision={revision!.ref} path={target.path} entries={object.entries} lastCommit={history?.nodes[0]} commitCount={history?.totalCount} />
              )}
            </Toolbar>
          )}
        </>
      )}
    </RepoFrame>
  );
}

/**
 * Branch picker, path and the code actions above `children`. With an `aside` (the root's sidebar) it adds a
 * second column that sticks under the tab bar on wide screens, headed by the actions. Only the aside scrolls, so
 * the Code menu isn't clipped.
 */
function Toolbar({ repo, gitRef, path, aside, children }: { repo: Repo; gitRef: string; path: string; aside?: ReactNode; children: ReactNode }) {
  const [owner, name] = repo.nameWithOwner.split('/') as [string, string];
  const [finding, setFinding] = useState(false);
  const segments = path ? path.split('/') : [];
  const openFinder = useCallback(() => setFinding(true), []);
  usePageHotkey('t', openFinder, 'Go to file');

  const pinned = useIsPinned(repo.nameWithOwner);
  const commands = useMemo<Command[]>(
    () => [
      { id: 'repo:find', group: 'Repository', title: 'Go to file…', hint: 'T', icon: <HugeiconsIcon icon={FileSearchIcon} />, perform: openFinder },
      pinned
        ? { id: 'repo:unpin', group: 'Repository', title: 'Unpin from sidebar', icon: <HugeiconsIcon icon={PinOffIcon} />, perform: () => unpin(repo.nameWithOwner) }
        : { id: 'repo:pin', group: 'Repository', title: 'Pin to sidebar', icon: <HugeiconsIcon icon={PinIcon} />, perform: () => pin(repo.nameWithOwner) },
      { id: 'repo:clone-https', group: 'Repository', title: 'Copy HTTPS clone URL', icon: <HugeiconsIcon icon={Copy01Icon} />, perform: () => copy(`${repo.url}.git`, 'clone URL') },
      { id: 'repo:clone-ssh', group: 'Repository', title: 'Copy SSH clone URL', icon: <HugeiconsIcon icon={Copy01Icon} />, perform: () => copy(repo.sshUrl, 'clone URL') },
      { id: 'repo:clone-gh', group: 'Repository', title: 'Copy gh repo clone', icon: <HugeiconsIcon icon={Copy01Icon} />, perform: () => copy(`gh repo clone ${repo.nameWithOwner}`, 'clone command') },
      { id: 'repo:issues', group: 'Repository', title: 'Issues', icon: <HugeiconsIcon icon={CircleDotIcon} />, perform: () => navigate(`/${repo.nameWithOwner}/issues`) },
      { id: 'repo:pulls', group: 'Repository', title: 'Pull requests', icon: <HugeiconsIcon icon={GitPullRequestIcon} />, perform: () => navigate(`/${repo.nameWithOwner}/pulls`) },
      { id: 'repo:actions', group: 'Repository', title: 'Actions', icon: <HugeiconsIcon icon={PlayIcon} />, perform: () => navigate(`/${repo.nameWithOwner}/actions`) },
      { id: 'repo:new-issue', group: 'Repository', title: 'New issue', icon: <HugeiconsIcon icon={PlusSignIcon} />, perform: () => navigate(`/${repo.nameWithOwner}/issues/new`) },
      { id: 'repo:new-pr', group: 'Repository', title: 'New pull request', icon: <HugeiconsIcon icon={GitPullRequestCreateIcon} />, perform: () => navigate(`/${repo.nameWithOwner}/compare`) },
    ],
    [repo, openFinder, pinned],
  );
  useRegisterCommands('repo', commands);
  // Tailwind's `lg`.
  const actionsInColumn = useMedia('(min-width: 64rem)') && !!aside;

  const actions = (
    <div className={cx('flex items-center justify-end gap-2', !actionsInColumn && 'ml-auto')}>
      <button
        type="button"
        onClick={openFinder}
        className="flex h-8 w-52 cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] text-subtle hover:border-line-strong hover:text-muted"
      >
        <HugeiconsIcon icon={FileSearchIcon} className="size-3.5" />
        Go to file
        <Kbd className="ml-auto">T</Kbd>
      </button>
      <CloneMenu repo={repo} gitRef={gitRef} />
    </div>
  );
  const bar = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <BranchPicker owner={owner} name={name} current={gitRef} hrefFor={(ref) => treeUrl(repo.nameWithOwner, ref, path)} />
      {!path && (
        <span className="hidden items-center gap-3 px-2 text-[12.5px] text-muted sm:flex">
          <a href={`/${repo.nameWithOwner}/branches`} className="flex items-center gap-1.5 hover:text-fg">
            <HugeiconsIcon icon={GitBranchIcon} className="size-3.5 text-subtle" />
            <b className="font-medium text-fg">{repo.branches.totalCount}</b> branches
          </a>
          <a href={`/${repo.nameWithOwner}/tags`} className="flex items-center gap-1.5 hover:text-fg">
            <HugeiconsIcon icon={Tag01Icon} className="size-3.5 text-subtle" />
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
            <HugeiconsIcon icon={Copy01Icon} className="size-3" />
          </button>
        </div>
      )}
      {!actionsInColumn && actions}
    </div>
  );

  return (
    <>
      {aside ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_296px]">
          <div className="min-w-0">
            {bar}
            {children}
          </div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-[108px] lg:max-h-[calc(100vh-124px)] lg:self-start">
            {actionsInColumn && actions}
            {aside}
          </div>
        </div>
      ) : (
        <>
          {bar}
          {children}
        </>
      )}
      {finding && <FileFinder nameWithOwner={repo.nameWithOwner} gitRef={gitRef} onClose={() => setFinding(false)} />}
    </>
  );
}
