import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen01Icon, CornerLeftUpIcon, File02Icon, Folder01Icon, FolderGitIcon, HistoryIcon } from '@hugeicons/core-free-icons';
import { timeAgo, fullDate } from '@/lib/time';
import { Avatar, Markdown, Panel, Skeleton } from '@/ui/primitives';
import { CheckIcon } from '@/ui/status';
import { LoadError } from './LoadError';
import { repoEntryCommitsQuery, repoHeadCommitQuery, repoReadmeQuery, sortEntries, type LastCommit, type TreeEntry } from './query';
import { blobUrl, commitsUrl, treeUrl } from './urls';

/** `gitRef` is what links use (a branch name); `revision` is what data is read at (HEAD at a repo's root). */
type Props = { nameWithOwner: string; gitRef: string; revision: string; path: string; entries: TreeEntry[]; lastCommit?: LastCommit; commitCount?: number };

/** A folder: latest commit, entries with their last commit, then the folder's README. */
export function TreeView({ nameWithOwner, gitRef, revision, path, entries, lastCommit, commitCount }: Props) {
  const [owner, name] = nameWithOwner.split('/') as [string, string];
  const sorted = sortEntries(entries);
  const commits = useQuery(repoEntryCommitsQuery(owner, name, revision, path, entries));

  const readmeEntry = sorted.find((e) => e.type === 'blob' && /^readme(\.(md|markdown|mdx|rst|txt))?$/i.test(e.name));

  const parent = path.split('/').slice(0, -1).join('/');

  return (
    <div className="flex flex-col gap-6">
      <Panel className="overflow-hidden">
        {lastCommit && <CommitBar nameWithOwner={nameWithOwner} gitRef={gitRef} path={path} commit={lastCommit} count={commitCount} />}
        {path && (
          <a href={treeUrl(nameWithOwner, gitRef, parent)} data-row className="flex h-10 items-center gap-3 border-b border-line px-4 text-[13px] text-muted hover:bg-hover focus:bg-hover focus:outline-none">
            <HugeiconsIcon icon={CornerLeftUpIcon} className="size-4 text-subtle" />
            ..
          </a>
        )}
        {sorted.map((entry) => {
          const commit = commits.data?.[entry.path];
          const href = entry.type === 'tree' ? treeUrl(nameWithOwner, gitRef, entry.path) : entry.type === 'blob' ? blobUrl(nameWithOwner, gitRef, entry.path) : (entry.submodule?.gitUrl ?? '#');
          return (
            <div key={entry.path} className="group flex h-10 items-center gap-3 border-b border-line px-4 last:border-b-0 hover:bg-hover">
              {entry.type === 'tree' ? (
                <HugeiconsIcon icon={Folder01Icon} className="size-4 shrink-0 fill-accent/25 text-accent" />
              ) : entry.type === 'commit' ? (
                <HugeiconsIcon icon={FolderGitIcon} className="size-4 shrink-0 text-subtle" />
              ) : (
                <HugeiconsIcon icon={File02Icon} className="size-4 shrink-0 text-subtle" />
              )}
              <a href={href} data-row className="w-[38%] min-w-0 shrink-0 truncate text-[13px] hover:text-accent hover:underline focus:underline focus:outline-none">
                {entry.name}
              </a>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-subtle">
                {commits.isPending ? (
                  <Skeleton className="h-3 w-48" />
                ) : (
                  commit && (
                    <a href={commit.url} data-private="commits" className="hover:text-fg hover:underline">
                      {commit.messageHeadline}
                    </a>
                  )
                )}
              </span>
              <span className="w-20 shrink-0 text-right text-[12px] text-subtle" title={commit ? fullDate(commit.committedDate) : undefined}>
                {commit && timeAgo(commit.committedDate)}
              </span>
            </div>
          );
        })}
      </Panel>

      {readmeEntry && <ReadmePanel nameWithOwner={nameWithOwner} revision={revision} path={path} name={readmeEntry.name} />}
    </div>
  );
}

/** A folder's README, rendered by GitHub. `name` is its file's name; the Overview doesn't list files, so doesn't know it. */
export function ReadmePanel({ nameWithOwner, revision, path, name = 'README' }: { nameWithOwner: string; revision: string; path: string; name?: string }) {
  const readme = useQuery(repoReadmeQuery(nameWithOwner, revision, path));
  return (
    <Panel className="overflow-hidden">
      <div className="flex h-10 items-center gap-2 border-b border-line px-4 text-[12.5px] font-medium">
        <HugeiconsIcon icon={BookOpen01Icon} className="size-3.5 text-subtle" />
        {name}
      </div>
      <div className="px-8 py-6">
        {readme.data ? (
          <Markdown html={readme.data} />
        ) : readme.error ? (
          <LoadError what="the README" error={readme.error} retry={readme.refetch} />
        ) : readme.isPending ? (
          <Skeleton className="h-40" />
        ) : (
          <p className="text-[13px] text-muted">No README.</p>
        )}
      </div>
    </Panel>
  );
}

/** The Overview's strip above the README: the default branch (`gitRef`) and its latest commit. */
export function HeadCommitPanel({ nameWithOwner, gitRef }: { nameWithOwner: string; gitRef: string }) {
  const [owner, name] = nameWithOwner.split('/') as [string, string];
  const head = useQuery(repoHeadCommitQuery(owner, name));
  if (!head.isPending && !head.data) return null;
  return (
    <Panel className="overflow-hidden">
      {head.data ? (
        <CommitBar nameWithOwner={nameWithOwner} gitRef={gitRef} path="" commit={head.data.commit} count={head.data.count} />
      ) : (
        <div className="flex h-12 items-center px-4">
          <Skeleton className="h-3 w-72" />
        </div>
      )}
    </Panel>
  );
}

/** Latest commit for the current folder, with the history count. */
export function CommitBar({ nameWithOwner, gitRef, path, commit, count }: { nameWithOwner: string; gitRef: string; path: string; commit: LastCommit; count?: number }) {
  const user = commit.author?.user;
  return (
    <div className="flex h-12 items-center gap-3 border-b border-line bg-elevated/40 last:border-b-0 px-4 text-[12.5px]">
      <Avatar src={user?.avatarUrl} size={20} />
      <span className="shrink-0 font-medium">{user?.login ?? commit.author?.name}</span>
      <a href={commit.url} data-private="commits" className="min-w-0 truncate text-muted hover:text-fg hover:underline">
        {commit.messageHeadline}
      </a>
      <CheckIcon state={commit.statusCheckRollup?.state} />
      <span className="ml-auto flex shrink-0 items-center gap-3 text-subtle">
        <a href={commit.url} className="font-mono text-[11.5px] hover:text-fg">
          {commit.abbreviatedOid}
        </a>
        <span title={fullDate(commit.committedDate)}>{timeAgo(commit.committedDate)}</span>
        <a href={commitsUrl(nameWithOwner, gitRef, path)} className="flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-muted hover:bg-hover hover:text-fg">
          <HugeiconsIcon icon={HistoryIcon} className="size-3.5" />
          {count !== undefined ? `${count.toLocaleString()} commit${count === 1 ? '' : 's'}` : 'History'}
        </a>
      </span>
    </div>
  );
}

export function TreeSkeleton() {
  return (
    <Panel className="flex flex-col gap-3 p-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </Panel>
  );
}
