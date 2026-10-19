import type { DiffsApi } from '@/entrypoints/diffs';
import type { Route } from '@/lib/routes';

let loading: Promise<DiffsApi> | undefined;

/**
 * The code renderer (src/entrypoints/diffs.ts), loaded once per page on first call. Code pages start it when
 * their navigation starts (see `preloadCode`); pull request and repo pages call it while idle, so it's
 * usually ready before a diff or file is opened.
 */
export function loadDiffs(): Promise<DiffsApi> {
  loading ??= import(/* @vite-ignore */ browser.runtime.getURL('/diffs.js')).then(() => {
    if (!globalThis.__unmergedDiffs) throw new Error('Diff renderer failed to load');
    return globalThis.__unmergedDiffs;
  });
  loading.catch(() => (loading = undefined));
  return loading;
}

/**
 * What a route opens on: diffs (Files changed, a commit, a comparison), a file in a repo, or neither. A repo
 * route can't tell a file from a folder, so folders count as files.
 */
export function codeOf(route: Route): 'diffs' | 'file' | undefined {
  switch (route.kind) {
    case 'pr':
      return route.tab === 'files' ? 'diffs' : undefined;
    case 'commit':
      return 'diffs';
    case 'compare':
      return route.head ? 'diffs' : undefined;
    case 'repo':
      return route.view === 'code' && route.rest.length > 0 ? 'file' : undefined;
    default:
      return undefined;
  }
}

/**
 * Starts loading what a page of code draws with, alongside its requests: the renderer and, for diffs, the
 * highlighting themes, so the first diff draws as soon as its patch is in. All of it is in the package: this
 * costs no network.
 */
export function preloadCode(route: Route) {
  const code = codeOf(route);
  if (!code) return;
  const renderer = loadDiffs();
  (code === 'diffs' ? renderer.then((api) => api.preloadHighlighting([])) : renderer).catch(() => {});
}
