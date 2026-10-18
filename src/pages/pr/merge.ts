import type { MergeMethod, PullRequest, Repo } from './query';

/** The merge methods the repository allows, in GitHub's order. */
export const mergeMethods = (repo: Repo) =>
  (['SQUASH', 'MERGE', 'REBASE'] as const).filter((m) => (m === 'SQUASH' ? repo.squashMergeAllowed : m === 'MERGE' ? repo.mergeCommitAllowed : repo.rebaseMergeAllowed));

/** The method a merge starts with: the viewer's last one while the repository still allows it. */
export function defaultMergeMethod(repo: Repo, methods: readonly MergeMethod[] = mergeMethods(repo)): MergeMethod {
  return methods.includes(repo.viewerDefaultMergeMethod) ? repo.viewerDefaultMergeMethod : (methods[0] ?? 'MERGE');
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
