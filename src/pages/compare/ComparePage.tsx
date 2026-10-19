import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon, GitPullRequestCreateIcon, InformationCircleIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { rest } from '@/github/client';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { emitNavigate, navigate } from '@/lib/navigation';
import type { CompareRoute } from '@/lib/routes';
import { useTitle } from '@/lib/useTitle';
import { CommitFiles } from '@/pages/commit/CommitFiles';
import { BranchPicker } from '@/pages/repo/BranchPicker';
import { RepoFrame, useRepo } from '@/pages/repo/RepoFrame';
import { Button } from '@/ui/Button';
import { CommentBox } from '@/ui/CommentBox';
import { CommitList } from '@/ui/CommitList';
import { Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import { compareHref, compareQuery, headRepo, newPullRequest, prefill, prTemplateQuery, type Comparison } from './query';

type Props = Omit<CompareRoute, 'kind'>;

/**
 * Compare two refs under the repo header: branch pickers, whether they merge cleanly, then the commits and
 * the diff in the PR Files tab's viewer. `expand` opens the form that turns the comparison into a pull request.
 */
export function ComparePage({ owner, repo: name, base, head, expand }: Props) {
  const queryClient = useQueryClient();
  const repo = useRepo(owner, name).data?.repository;
  // A fork's branch is proposed to the repo it was forked from. GitHub's server redirects a full page load the
  // same way; this covers in-place navigations (the recent-pushes banner).
  const toParent = !base && !!head && !head.includes(':') && !!repo?.parent;
  const comparison = useQuery({ ...compareQuery(owner, name, base, head ?? ''), enabled: !!head && !toParent });

  useEffect(() => {
    if (!toParent || !repo?.parent || !head) return;
    // Replaced, so Back doesn't land here and bounce forward again.
    const url = new URL(compareHref(repo.parent.nameWithOwner, undefined, `${repo.nameWithOwner.replace('/', ':')}:${head}`, expand), location.href);
    history.replaceState(null, '', url);
    emitNavigate(url);
  }, [toParent, repo, head, expand]);

  // The diff renderer and the grammars these files need load alongside the comparison.
  useEffect(() => {
    if (!head || toParent) return;
    Promise.all([loadDiffs(), queryClient.fetchQuery(compareQuery(owner, name, base, head))])
      .then(([renderer, { files }]) => renderer.preloadHighlighting(files.map((f) => f.filename)))
      .catch(() => {});
  }, [queryClient, owner, name, base, head, toParent]);

  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  const baseName = base ?? repo?.defaultBranchRef?.name;
  useTitle(head && baseName ? `Comparing ${baseName}...${head} · ${nwo}` : `Compare · ${nwo}`);

  const data = comparison.data;
  const canOpen = !!data && data.aheadBy > 0;

  return (
    <RepoFrame owner={owner} name={name} view="pulls" item="Compare">
      <h1 className="text-[20px] font-semibold tracking-tight">{expand && canOpen ? 'Open a pull request' : 'Compare changes'}</h1>
      <p className="mt-1 text-[13px] text-muted">Choose two branches to see what's changed or to start a new pull request.</p>

      <div className="mt-4 mb-6 flex min-h-8 flex-wrap items-center gap-2">
        {repo && baseName ? <Pickers owner={owner} name={name} base={baseName} head={head} expand={expand} /> : <Skeleton className="h-8 w-[420px] max-w-full rounded-lg" />}
        {data && <MergeHint comparison={data} base={baseName ?? ''} />}
        {canOpen && !expand && head && (
          <a
            href={compareHref(nwo, base, head, true)}
            className="ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-success px-3 text-[13px] font-medium text-white hover:brightness-110"
          >
            <HugeiconsIcon icon={GitPullRequestCreateIcon} className="size-3.5" />
            Create pull request
          </a>
        )}
      </div>

      {!head ? (
        <Panel>
          <Empty>Choose a branch to compare with {baseName ?? 'the default branch'}.</Empty>
        </Panel>
      ) : comparison.error ? (
        <Panel className="p-8 text-[13px]">
          <p className="text-danger">{comparison.error.message}</p>
          <Button className="mt-4" onClick={openClassic}>
            Open in classic GitHub
          </Button>
        </Panel>
      ) : !data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-[280px] max-w-full" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : !canOpen ? (
        <Panel>
          <Empty>
            There isn't anything to compare.{' '}
            {data.status === 'identical' ? `${baseName} and ${head} are identical.` : `${baseName} is up to date with all commits from ${head}.`}
          </Empty>
        </Panel>
      ) : (
        <>
          {expand && baseName && <CreateForm key={`${baseName}...${head}`} owner={owner} repo={name} base={baseName} head={head} comparison={data} />}
          <ComparisonBody nwo={nwo} head={headRepo(head, owner, name)} comparison={data} />
        </>
      )}
    </RepoFrame>
  );
}

/** base ← compare. Each picker keeps the other side and whether the form is open. */
function Pickers({ owner, name, base, head, expand }: { owner: string; name: string; base: string; head?: string; expand: boolean }) {
  const nwo = `${owner}/${name}`;
  // A fork's branches are listed from the fork, and keep its "owner:" when picked.
  const from = headRepo(head ?? base, owner, name);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] text-subtle">
      <span>base</span>
      <BranchPicker owner={owner} name={name} current={base} hrefFor={(ref) => compareHref(nwo, ref, head ?? base, expand)} />
      <HugeiconsIcon icon={ArrowLeft02Icon} className="size-3.5" />
      <span>compare</span>
      <BranchPicker owner={from.owner} name={from.repo} current={head ?? base} hrefFor={(ref) => compareHref(nwo, base, from.prefix + ref, expand)} />
    </div>
  );
}

/**
 * What GitHub can promise before a pull request exists: a head that's only ahead merges cleanly. A diverged one
 * might conflict, which GitHub only works out once the pull request is open.
 */
function MergeHint({ comparison: { status, aheadBy, behindBy }, base }: { comparison: Comparison; base: string }) {
  if (!aheadBy) return null;
  if (status === 'ahead') {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px]">
        <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-success" />
        <span className="font-medium text-success">Able to merge.</span>
        <span className="text-muted">These branches can be automatically merged.</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
      <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5 text-subtle" />
      {behindBy} commit{behindBy === 1 ? '' : 's'} behind {base}. Conflicts are checked once the pull request is open.
    </span>
  );
}

/** The commits (oldest first, as they'd appear in the pull request), then the diff from the merge base. */
function ComparisonBody({ nwo, head, comparison }: { nwo: string; head: ReturnType<typeof headRepo>; comparison: Comparison }) {
  const { commits, files, totalCommits } = comparison;
  const headNwo = `${head.owner}/${head.repo}`;
  const oid = commits.at(-1)?.oid ?? '';
  const source = useMemo(() => ({ nameWithOwner: headNwo, oid }), [headNwo, oid]);
  const additions = files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const contributors = new Set(commits.map((c) => c.author?.user?.login ?? c.author?.name)).size;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <span>
          <span className="font-medium text-fg tabular-nums">{totalCommits}</span> commit{totalCommits === 1 ? '' : 's'}
        </span>
        <span>
          <span className="font-medium text-fg tabular-nums">{files.length}</span> file{files.length === 1 ? '' : 's'} changed
        </span>
        <span>
          <span className="font-medium text-fg tabular-nums">{contributors}</span> contributor{contributors === 1 ? '' : 's'}
        </span>
        <span className="font-mono text-[11.5px] tabular-nums">
          <span className="text-success">+{additions.toLocaleString()}</span> <span className="text-danger">−{deletions.toLocaleString()}</span>
        </span>
        {totalCommits > commits.length && <span className="text-subtle">Showing the first {commits.length} commits.</span>}
      </div>
      <div className="mb-8 max-w-[960px]">
        <CommitList commits={commits} nameWithOwner={nwo} commitHref={(sha) => `/${headNwo}/commit/${sha}`} />
      </div>
      <CommitFiles files={files} error={null} source={source} />
    </>
  );
}

/**
 * Title, description and draft toggle for the new pull request, started as GitHub would (see `prefill`).
 * Mounts once the comparison is in; the template, if any, is waited for so it isn't typed over.
 */
function CreateForm({ owner, repo, base, head, comparison }: { owner: string; repo: string; base: string; head: string; comparison: Comparison }) {
  const template = useQuery(prTemplateQuery(owner, repo));
  if (template.isPending) return <Skeleton className="mb-8 h-[260px] max-w-[960px] rounded-xl" />;
  return <PullRequestFields owner={owner} repo={repo} base={base} head={head} initial={prefill(comparison.commits, head, template.data ?? null)} />;
}

function PullRequestFields({ owner, repo, base, head, initial }: { owner: string; repo: string; base: string; head: string; initial: { title: string; body: string } }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [draft, setDraft] = useState(false);
  const create = useMutation({
    mutationFn: () => rest<{ number: number }>(`/repos/${owner}/${repo}/pulls`, { method: 'POST', body: newPullRequest({ owner, repo, base, head, title: title.trim(), body, draft }) }),
    onSuccess: ({ number }) => {
      // The branch now has a pull request, so the repo's "recent pushes" banner drops it.
      queryClient.invalidateQueries({ queryKey: ['repo-recent-pushes'] });
      navigate(`/${owner}/${repo}/pull/${number}`);
    },
    onError: toast.error,
  });
  const submit = () => {
    if (title.trim() && !create.isPending) create.mutate();
  };

  return (
    <div className="mb-8 flex max-w-[960px] flex-col gap-3">
      <input
        autoFocus
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="h-10 rounded-lg border border-line bg-panel px-3 text-[15px] font-medium outline-none placeholder:text-subtle focus:border-line-strong"
      />
      <CommentBox value={body} onChange={setBody} onSubmit={submit} rows={10} placeholder="Add a description… Markdown supported">
        <button
          type="button"
          onClick={() => setDraft(!draft)}
          aria-pressed={draft}
          title="A draft can't be merged until it's marked ready for review"
          className={cx(
            'flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors',
            draft ? 'border-accent/40 bg-accent/12 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
          )}
        >
          <span className={cx('flex size-3.5 items-center justify-center rounded-[4px] border', draft ? 'border-accent bg-accent text-white' : 'border-line-strong')}>
            {draft && <HugeiconsIcon icon={Tick02Icon} className="size-2.5" strokeWidth={3.5} />}
          </span>
          Draft
        </button>
        <Button size="sm" variant="success" className="ml-auto" disabled={!title.trim()} loading={create.isPending} onClick={submit}>
          {draft ? 'Create draft pull request' : 'Create pull request'}
          <span className="flex gap-0.5 opacity-70">
            <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">⌘</Kbd>
            <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">↵</Kbd>
          </span>
        </Button>
      </CommentBox>
    </div>
  );
}
