/**
 * The pull request the product shot shows. `prerenderDiffs.ts` renders `PATCHES` with the extension's diff
 * renderer at build time; the components draw everything else from here.
 */

export type ChangedFile = {
  path: string;
  status: 'added' | 'modified';
  additions: number;
  deletions: number;
  viewed?: boolean;
};

// In GitHub's order (byte order of the path), which the file cards follow. They add up to the PR's totals.
export const FILES: ChangedFile[] = [
  { path: 'src/lib/drafts.ts', status: 'added', additions: 96, deletions: 0, viewed: true },
  { path: 'src/pages/pr/files/DiffBody.tsx', status: 'modified', additions: 214, deletions: 58, viewed: true },
  { path: 'src/pages/pr/nextReview.ts', status: 'modified', additions: 1, deletions: 1 },
  { path: 'src/pages/pr/pendingReview.ts', status: 'modified', additions: 5, deletions: 2 },
  { path: 'src/pages/pr/query.ts', status: 'modified', additions: 87, deletions: 12 },
  { path: 'src/pages/pr/review/Composer.tsx', status: 'modified', additions: 142, deletions: 61 },
  { path: 'src/pages/pr/review/ReviewBar.tsx', status: 'added', additions: 118, deletions: 0 },
  { path: 'src/pages/pr/review/Threads.tsx', status: 'modified', additions: 176, deletions: 94 },
  { path: 'src/pages/pr/usePrMutation.ts', status: 'modified', additions: 45, deletions: 18 },
  { path: 'src/ui/CommentBox.tsx', status: 'modified', additions: 52, deletions: 66 },
  { path: 'src/ui/Kbd.tsx', status: 'added', additions: 24, deletions: 0 },
  { path: 'tests/drafts.test.ts', status: 'added', additions: 142, deletions: 0 },
  { path: 'tests/nextReview.test.ts', status: 'added', additions: 61, deletions: 0 },
  { path: 'tests/pendingReview.test.ts', status: 'added', additions: 121, deletions: 0 },
];

export const ADDITIONS = FILES.reduce((sum, f) => sum + f.additions, 0);
export const DELETIONS = FILES.reduce((sum, f) => sum + f.deletions, 0);

/** Diffs of the files whose cards are open, keyed by path. */
export const PATCHES = {
  'src/pages/pr/nextReview.ts': `--- a/src/pages/pr/nextReview.ts
+++ b/src/pages/pr/nextReview.ts
@@ -10,7 +10,7 @@ import type { Pr } from './query';
 /**
  * The next pull request waiting on you, offered after you approve or merge one. Skips the one you just
  * reviewed.
  */
 export function nextReview(prs: Pr[]) {
-  return prs.find((pr) => pr.reviewRequested);
+  return prs.find((pr) => pr.reviewRequested && !pr.isDraft);
 }
`,
  'src/pages/pr/pendingReview.ts': `--- a/src/pages/pr/pendingReview.ts
+++ b/src/pages/pr/pendingReview.ts
@@ -3,4 +3,7 @@ import { MUTATIONS, type PullRequest } from './query';
-/** Line comments post one by one, like a plain comment. */
+/** Line comments collect into the viewer's pending review, like on GitHub: the first one starts it. */
 export function addLineComment(pr: PullRequest, body: string, line: number) {
-  return { query: MUTATIONS.addComment, variables: { id: pr.id, body, line } };
+  const pending = pr.viewerPendingReview?.nodes[0];
+  return pending
+    ? { query: MUTATIONS.addReviewThread, variables: { review: pending.id, body, line } }
+    : { query: MUTATIONS.startReview, variables: { id: pr.id, body, line } };
 }
`,
} as const;

export type PatchPath = keyof typeof PATCHES;
/** Where the review thread sits: under this new-side line of this file. */
export const THREAD = { path: 'src/pages/pr/nextReview.ts', line: 15 } satisfies { path: PatchPath; line: number };
