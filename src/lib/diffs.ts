import type { DiffsApi } from '@/entrypoints/diffs';

let loading: Promise<DiffsApi> | undefined;

/**
 * The diff renderer (src/entrypoints/diffs.ts), loaded once per page on first call. Pull request pages call
 * it early so it's usually ready before anyone opens Files changed.
 */
export function loadDiffs(): Promise<DiffsApi> {
  loading ??= import(/* @vite-ignore */ browser.runtime.getURL('/diffs.js')).then(() => {
    if (!globalThis.__unmergedDiffs) throw new Error('Diff renderer failed to load');
    return globalThis.__unmergedDiffs;
  });
  loading.catch(() => (loading = undefined));
  return loading;
}
