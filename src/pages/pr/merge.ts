import { useMemo } from 'react';
import { createStore } from '@/lib/store';
import type { MenuOption } from '@/ui/Menu';
import type { MergeMethod, PullRequest, Repo } from './query';

export const METHOD_LABEL: Record<MergeMethod, string> = {
  SQUASH: 'Squash and merge',
  MERGE: 'Create a merge commit',
  REBASE: 'Rebase and merge',
};

const METHOD_HINT: Record<MergeMethod, string> = {
  SQUASH: 'Combine all commits into one on the base branch',
  MERGE: 'Keep every commit and add a merge commit',
  REBASE: 'Replay commits onto the base branch',
};

/** The merge method menu's options. */
export const methodOptions = (methods: readonly MergeMethod[]) =>
  methods.map((m): MenuOption<MergeMethod> => ({ value: m, label: METHOD_LABEL[m], hint: METHOD_HINT[m] }));

/** The merge methods the repository allows, in GitHub's order. */
export const mergeMethods = (repo: Repo) =>
  (['SQUASH', 'MERGE', 'REBASE'] as const).filter((m) => (m === 'SQUASH' ? repo.squashMergeAllowed : m === 'MERGE' ? repo.mergeCommitAllowed : repo.rebaseMergeAllowed));

/** The method a merge starts with: the viewer's last one while the repository still allows it. */
export function defaultMergeMethod(repo: Repo, methods: readonly MergeMethod[] = mergeMethods(repo)): MergeMethod {
  return methods.includes(repo.viewerDefaultMergeMethod) ? repo.viewerDefaultMergeMethod : (methods[0] ?? 'MERGE');
}

/** The method the user picked for each PR (by id) in this tab. */
const picked = createStore<Record<string, MergeMethod>>({});

/**
 * The PR's merge method: the one the user picked for it, else the default. The merge box and Slide to merge
 * share it, so they always merge the same way.
 */
export function useMergeMethod(pr: PullRequest, repo: Repo) {
  const methods = useMemo(() => mergeMethods(repo), [repo]);
  const choice = picked.use()[pr.id];
  const method = choice && methods.includes(choice) ? choice : defaultMergeMethod(repo, methods);
  const setMethod = (m: MergeMethod) => picked.set({ ...picked.get(), [pr.id]: m });
  return { methods, method, setMethod };
}

/** GitHub's commit message for a merge with `method`. A rebase makes no commit of its own. */
export function defaultCommitMessage(pr: PullRequest, method: MergeMethod): { headline?: string; body?: string } {
  if (method === 'SQUASH') return { headline: pr.squashHeadline, body: pr.squashBody };
  if (method === 'MERGE') return { headline: pr.mergeHeadline, body: pr.mergeBody };
  return {};
}

/** Whether GitHub lets the PR merge now, with no rule bypass. */
export const isMergeReady = (pr: PullRequest) => pr.mergeStateStatus === 'CLEAN' || pr.mergeStateStatus === 'HAS_HOOKS' || pr.mergeStateStatus === 'UNSTABLE';

/**
 * Whether the viewer can merge the PR in one step: open, ready, not handled by a merge queue or auto-merge, and
 * the viewer can push to the repository. Slide to merge shows only then.
 */
export function canMergeNow(pr: PullRequest, repo: Repo) {
  const permission = repo.viewerPermission;
  return (
    pr.state === 'OPEN' &&
    !pr.isDraft &&
    isMergeReady(pr) &&
    !pr.isMergeQueueEnabled &&
    !pr.isInMergeQueue &&
    !pr.autoMergeRequest &&
    (permission === 'ADMIN' || permission === 'MAINTAIN' || permission === 'WRITE') &&
    mergeMethods(repo).length > 0
  );
}
