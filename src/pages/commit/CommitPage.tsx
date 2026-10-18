import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Copy01Icon, FolderTreeIcon } from '@hugeicons/core-free-icons';
import { openClassic } from '@/lib/classic';
import { copy } from '@/lib/clipboard';
import { loadDiffs } from '@/lib/diffs';
import { useIsDark } from '@/lib/settings';
import { fullDate, timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { RepoFrame } from '@/pages/repo/RepoFrame';
import { Button } from '@/ui/Button';
import { checkCounts, CommitPerson } from '@/ui/CommitList';
import { Avatar, Panel, Skeleton } from '@/ui/primitives';
import { CommitChecks } from './CommitChecks';
import { CommitFiles } from './CommitFiles';
import { commitFilesQuery, commitQuery, type Commit } from './query';

type Props = { owner: string; repo: string; sha: string; pr?: number };

/**
 * One commit under the repo header: its message, people, checks and parents, then its files in the PR Files
 * tab's tree and diffs. Opened from a pull request's commits, it leads back to them.
 */
export function CommitPage({ owner, repo, sha, pr }: Props) {
  // The diff renderer and the grammars these files need load alongside the files.
  const queryClient = useQueryClient();
  const dark = useIsDark();
  useEffect(() => {
    Promise.all([loadDiffs(), queryClient.fetchQuery(commitFilesQuery(owner, repo, sha))])
      .then(([renderer, files]) => renderer.preloadHighlighting(files.map((f) => f.filename), dark))
      .catch(() => {});
  }, [queryClient, owner, repo, sha, dark]);

  const { data, error } = useQuery(commitQuery(owner, repo, sha, pr));
  const files = useQuery(commitFilesQuery(owner, repo, sha));
  const source = useMemo(() => ({ nameWithOwner: `${owner}/${repo}`, oid: sha }), [owner, repo, sha]);
  const commit = data?.repository?.object;
  const nwo = `${owner}/${repo}`;
  useTitle(commit && `${commit.messageHeadline} · ${nwo}@${commit.abbreviatedOid}`);

  return (
    <RepoFrame owner={owner} name={repo} view="commits">
      {pr !== undefined && (
        <a href={`/${nwo}/pull/${pr}/commits`} className="mb-4 flex max-w-full items-center gap-1.5 text-[12.5px] text-muted hover:text-fg">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5 shrink-0" />
          <span data-private="titles" className="truncate">
            {data?.repository?.pullRequest?.title ?? 'Pull request'}
          </span>
          <span className="shrink-0 text-subtle">#{pr}</span>
        </a>
      )}
      {error || (data && !commit) ? (
        <Panel className="p-8 text-[13px]">
          <p className="text-danger">{error?.message ?? "That commit isn't in this repository."}</p>
          <Button className="mt-4" onClick={openClassic}>
            Open in classic GitHub
          </Button>
        </Panel>
      ) : (
        <>
          {commit ? <CommitHeader commit={commit} owner={owner} repo={repo} /> : <HeaderSkeleton />}
          <CommitFiles files={files.data} error={files.error} source={source} />
        </>
      )}
    </RepoFrame>
  );
}

function CommitHeader({ commit, owner, repo }: { commit: Commit; owner: string; repo: string }) {
  const nameWithOwner = `${owner}/${repo}`;
  const rollup = commit.statusCheckRollup;
  const author = commit.author?.user?.login ?? commit.author?.name;
  const committer = commit.committer?.user?.login ?? commit.committer?.name;
  const { totalCount, nodes: parents } = commit.parents;

  return (
    <div className="mb-6">
      <h1 data-private="commits" className="text-[20px] leading-snug font-semibold tracking-tight break-words">
        {commit.messageHeadline}
      </h1>
      {commit.messageBody && <pre data-private="commits" className="mt-3 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-muted">{commit.messageBody}</pre>}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-subtle">
        <span className="flex flex-wrap items-center gap-1.5">
          <Avatar src={commit.author?.user?.avatarUrl} size={20} />
          <CommitPerson person={commit.author} /> authored <span title={fullDate(commit.authoredDate)}>{timeAgo(commit.authoredDate)}</span>
          {committer !== author && (
            <>
              · <CommitPerson person={commit.committer} /> committed <span title={fullDate(commit.committedDate)}>{timeAgo(commit.committedDate)}</span>
            </>
          )}
        </span>
        {commit.signature?.isValid && (
          <span className="flex h-5 items-center rounded-full border border-success/30 px-2 text-[11px] font-medium text-success" title="Signed with a verified signature">
            Verified
          </span>
        )}
        {rollup && checkCounts(rollup).total > 0 && <CommitChecks owner={owner} repo={repo} oid={commit.oid} rollup={rollup} />}
        <span className="font-mono text-[11.5px] tabular-nums">
          <span className="text-success">+{commit.additions}</span> <span className="text-danger">−{commit.deletions}</span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          {totalCount > 0 && (
            <span className="mr-1 flex items-center gap-1.5">
              {totalCount} parent{totalCount === 1 ? '' : 's'}
              {parents.map((parent, i) => (
                <span key={parent.oid} className="flex items-center gap-1.5">
                  {i > 0 && '+'}
                  <a href={`/${nameWithOwner}/commit/${parent.oid}`} className="font-mono text-muted hover:text-fg hover:underline">
                    {parent.abbreviatedOid}
                  </a>
                </span>
              ))}
            </span>
          )}
          <button
            type="button"
            onClick={() => copy(commit.oid, 'commit SHA')}
            title="Copy full SHA"
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-elevated px-2 font-mono text-[11.5px] text-muted hover:border-line-strong hover:text-fg"
          >
            {commit.abbreviatedOid}
            <HugeiconsIcon icon={Copy01Icon} className="size-3" />
          </button>
          <a href={`/${nameWithOwner}/tree/${commit.oid}`} title="Browse files at this commit" className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
            <HugeiconsIcon icon={FolderTreeIcon} className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-7 w-[520px] max-w-full" />
      <Skeleton className="mt-4 h-5 w-[380px] max-w-full" />
    </div>
  );
}
