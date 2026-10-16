import { onlineManager } from '@tanstack/react-query';
import { GitHubError, type GitHubProblem } from '@/github/client';
import type { Route } from '@/lib/routes';
import { createStore } from '@/lib/store';

/** What the content script wants on screen: our page, or stock GitHub with a "back to Unmerged" pill. */
export type AppState = { mode: 'own'; route: Route } | { mode: 'classic' };

export const appState = createStore<AppState>({ mode: 'classic' });

/** Flipped when GitHub answers 401, so the token gate can ask for a new token. */
export const authRejected = createStore(false);

/** A rate limit or SSO block, for the banner over every page. */
export const githubBlock = createStore<Extract<GitHubProblem, { kind: 'rate-limit' | 'sso' }> | null>(null);

let resume: ReturnType<typeof setTimeout> | undefined;

/**
 * Turns a failed query or mutation into app state: a rejected token opens the token gate, a rate limit or
 * SSO block shows the banner. While rate-limited, TanStack Query sees GitHub as offline, so queries and polls
 * pause, then refetch whatever is stale once the limit resets.
 */
export function onApiError(error: unknown) {
  if (!(error instanceof GitHubError)) return;
  const { problem } = error;
  if (problem.kind === 'auth') return authRejected.set(true);
  if (problem.kind === 'sso') {
    // An active rate limit keeps the banner: it explains more (everything is paused until it lifts).
    if (githubBlock.get()?.kind !== 'rate-limit') githubBlock.set(problem);
    return;
  }
  if (problem.kind !== 'rate-limit') return;
  githubBlock.set(problem);
  onlineManager.setOnline(false);
  clearTimeout(resume);
  resume = setTimeout(() => {
    githubBlock.set(null);
    onlineManager.setOnline(true);
  }, problem.resetAt - Date.now());
}
