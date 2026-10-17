import { preloadPatchDiff } from '@pierre/diffs/ssr';
import type { Plugin } from 'vite';
import { DIFF_LOOK } from '../src/lib/diffLook.ts';
import { PATCHES, THREAD, type PatchPath } from './src/components/shot/pr.ts';

const ID = 'virtual:product-diffs';
const RESOLVED = `\0${ID}`;
const THEME_CSS = '<style data-theme-css';

/**
 * `virtual:product-diffs`: the product shot's diffs, drawn at build time by the extension's own renderer and
 * settings (`DIFF_LOOK`), so the site ships their HTML and none of the renderer. The icon sprite and core CSS
 * every diff starts with are exported once, as `shared`.
 */
export function prerenderDiffs(): Plugin {
  return {
    name: 'unmerged:product-diffs',
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    async load(id) {
      if (id !== RESOLVED) return;
      let shared = '';
      const diffs: Record<string, string> = {};
      for (const path of Object.keys(PATCHES) as PatchPath[]) {
        for (const diffStyle of ['unified', 'split'] as const) {
          const { prerenderedHTML: html } = await preloadPatchDiff({
            patch: PATCHES[path],
            annotations: path === THREAD.path ? [{ side: 'additions', lineNumber: THREAD.line }] : [],
            options: { ...DIFF_LOOK, themeType: 'dark', diffStyle, overflow: 'wrap' },
          });
          const split = html.indexOf(THEME_CSS);
          shared ||= html.slice(0, split);
          diffs[`${path}:${diffStyle}`] = html.slice(split);
        }
      }
      return `export const shared = ${JSON.stringify(shared)};\nexport const diffs = ${JSON.stringify(diffs)};`;
    },
  };
}
