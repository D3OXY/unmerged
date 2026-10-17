/**
 * How Unmerged draws diffs with `@pierre/diffs`: theme, change markers, and its own surfaces, type and diff
 * colors in the renderer's highest-priority layer. Used by `DiffBody` and by the website's product shot, which
 * renders its diffs with the same renderer at build time.
 */
export const DIFF_LOOK = {
  theme: { dark: 'pierre-dark', light: 'pierre-light' },
  lineDiffType: 'word-alt',
  diffIndicators: 'bars',
  hunkSeparators: 'line-info',
  disableFileHeader: true,
  unsafeCSS: `:host {
  --diffs-light-bg: var(--u-panel);
  --diffs-dark-bg: var(--u-panel);
  --diffs-font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --diffs-header-font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --diffs-font-size: 12px;
  --diffs-line-height: 20px;
  --diffs-addition-color: var(--u-green);
  --diffs-deletion-color: var(--u-red);
  --diffs-modified-color: var(--u-blue);
}`,
} as const;
