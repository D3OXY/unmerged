import type { DiffsApi } from '@/entrypoints/diffs';

let loading: Promise<DiffsApi> | undefined;

/**
 * The code renderer (src/entrypoints/diffs.ts), loaded once per page on first call. Pull request and repo
 * pages call it early, while idle, so it's usually ready before a diff or file is opened.
 */
export function loadDiffs(): Promise<DiffsApi> {
  loading ??= import(/* @vite-ignore */ browser.runtime.getURL('/diffs.js')).then(() => {
    if (!globalThis.__unmergedDiffs) throw new Error('Diff renderer failed to load');
    return globalThis.__unmergedDiffs;
  });
  loading.catch(() => (loading = undefined));
  return loading;
}
