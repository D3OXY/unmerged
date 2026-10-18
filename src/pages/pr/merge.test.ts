import { describe, expect, it } from 'vitest';
import { canMergeNow, defaultMergeMethod } from './merge';
import type { PullRequest, Repo } from './query';

const repo = (over: Partial<Repo> = {}) =>
  ({ squashMergeAllowed: true, mergeCommitAllowed: true, rebaseMergeAllowed: true, viewerDefaultMergeMethod: 'SQUASH', viewerPermission: 'WRITE', ...over }) as Repo;

const pr = (over: Partial<PullRequest> = {}) =>
  ({ state: 'OPEN', isDraft: false, mergeStateStatus: 'CLEAN', isMergeQueueEnabled: false, isInMergeQueue: false, autoMergeRequest: null, ...over }) as PullRequest;

describe('canMergeNow', () => {
  it('is true for a ready PR the viewer can push to', () => {
    expect(canMergeNow(pr(), repo())).toBe(true);
    expect(canMergeNow(pr({ mergeStateStatus: 'UNSTABLE' }), repo({ viewerPermission: 'ADMIN' }))).toBe(true);
  });

  it('is false while GitHub blocks the merge or the PR is a draft', () => {
    expect(canMergeNow(pr({ mergeStateStatus: 'BLOCKED' }), repo())).toBe(false);
    expect(canMergeNow(pr({ isDraft: true }), repo())).toBe(false);
  });

  it('is false when a merge queue or auto-merge handles the merge', () => {
    expect(canMergeNow(pr({ isMergeQueueEnabled: true }), repo())).toBe(false);
    expect(canMergeNow(pr({ autoMergeRequest: { mergeMethod: 'SQUASH', enabledBy: null } }), repo())).toBe(false);
  });

  it('is false without push access, also before the permission is known', () => {
    expect(canMergeNow(pr(), repo({ viewerPermission: 'TRIAGE' }))).toBe(false);
    expect(canMergeNow(pr(), repo({ viewerPermission: undefined }))).toBe(false);
  });
});

describe('defaultMergeMethod', () => {
  it("uses the viewer's method while the repository allows it, else the first allowed", () => {
    expect(defaultMergeMethod(repo({ viewerDefaultMergeMethod: 'REBASE' }))).toBe('REBASE');
    expect(defaultMergeMethod(repo({ viewerDefaultMergeMethod: 'REBASE', rebaseMergeAllowed: false }))).toBe('SQUASH');
  });
});
