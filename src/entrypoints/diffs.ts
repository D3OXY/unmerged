// The diff renderer, loaded on demand by src/lib/diffs.ts rather than with the content script: only pull
// request pages need it. Runs in the content script's isolated world, so the two share globals.
import '@/lib/customElementsShim';
import { FileDiff, getLineAnnotationName, getSingularPatch } from '@pierre/diffs';
import css from '@pierre/diffs/style';

let sheet: CSSStyleSheet | undefined;

/** Gives a plain element what <diffs-container> would (see customElementsShim): a shadow root with the core styles. */
function prepareContainer(element: HTMLElement) {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  }
  (element.shadowRoot ?? element.attachShadow({ mode: 'open' })).adoptedStyleSheets = [sheet];
}

const api = { FileDiff, getLineAnnotationName, getSingularPatch, prepareContainer };

export type DiffsApi = typeof api;

declare global {
  var __unmergedDiffs: DiffsApi | undefined;
}

export default defineUnlistedScript(() => {
  globalThis.__unmergedDiffs = api;
});
