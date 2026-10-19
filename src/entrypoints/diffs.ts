// The code renderer (diffs, and highlighting for the file view), loaded on demand by src/lib/diffs.ts rather
// than with the content script, which every github.com page loads. Runs in the content script's isolated
// world, so the two share globals.
import '@/lib/customElementsShim';
import { FileDiff, getFiletypeFromFileName, getLineAnnotationName, getSharedHighlighter, getSingularPatch } from '@pierre/diffs';
import css from '@pierre/diffs/style';
import { WorkerPoolManager } from '@pierre/diffs/worker';
import type { GrammarState } from 'shiki/core';
import { DIFF_LOOK } from '@/lib/diffLook';

let sheet: CSSStyleSheet | undefined;

/** Gives a plain element what <diffs-container> would (see customElementsShim): a shadow root with the core styles. */
function prepareContainer(element: HTMLElement) {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
  }
  (element.shadowRoot ?? element.attachShadow({ mode: 'open' })).adoptedStyleSheets = [sheet];
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CHUNK = 150;

/**
 * A file's lines as highlighted HTML, one string per line; plain (escaped) text for languages Shiki doesn't
 * know. Tokenizes CHUNK lines at a time, carrying the grammar state across (so strings and comments spanning
 * lines come out right) and yielding in between, so a long file never blocks input for long.
 */
async function highlightLines(text: string, path: string, dark: boolean) {
  const lines = text.split('\n');
  const lang = getFiletypeFromFileName(path);
  if (lang === 'text') return lines.map(escape);
  const theme = dark ? 'pierre-dark' : 'pierre-light';
  const highlighter = await getSharedHighlighter({ themes: [theme], langs: [lang] });
  const html: string[] = [];
  let grammarState: GrammarState | undefined;
  for (let start = 0; start < lines.length; start += CHUNK) {
    if (start) await new Promise((resolve) => setTimeout(resolve));
    const result = highlighter.codeToTokens(lines.slice(start, start + CHUNK).join('\n'), { lang, theme, grammarState });
    grammarState = result.grammarState;
    for (const line of result.tokens) {
      html.push(line.map(({ content, color, fontStyle = 0 }) => `<span style="color:${color}${fontStyle & 1 ? ';font-style:italic' : ''}">${escape(content)}</span>`).join(''));
    }
  }
  return html;
}

let pool: WorkerPoolManager | undefined;

/**
 * The workers that highlight diffs off the page's main thread: a diff draws its text at once and gets its
 * colors when a worker sends them. github.com can't start a worker from the extension's files, so a hidden
 * extension page framed into it starts them (src/entrypoints/highlighter); each worker talks to this page
 * through its own MessagePort. Diffs draw once the workers are up; if they don't start, diffs highlight here.
 */
function highlightPool() {
  if (pool) return pool;
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.src = browser.runtime.getURL('/highlighter.html');
  // Ports for the workers that the pool asks for before the frame has loaded.
  const ports: MessagePort[] = [];
  let send: (port: MessagePort) => void = (port) => ports.push(port);
  frame.addEventListener(
    'load',
    () => {
      send = (port) => frame.contentWindow?.postMessage(null, new URL(frame.src).origin, [port]);
      ports.splice(0).forEach(send);
    },
    { once: true },
  );
  document.documentElement.append(frame);
  pool = new WorkerPoolManager(
    {
      poolSize: 2,
      // Diffs don't draw until the workers are up, so don't wait long for them.
      workerInitializationTimeout: 3000,
      workerFactory: () => {
        const { port1, port2 } = new MessageChannel();
        send(port2);
        port1.start();
        // The pool only posts to a worker, listens to it and terminates it.
        return Object.assign(port1, { terminate: () => port1.close() }) as unknown as Worker;
      },
    },
    { theme: DIFF_LOOK.theme, lineDiffType: DIFF_LOOK.lineDiffType },
  );
  return pool;
}

/**
 * Starts the highlighting workers and loads the themes and the grammars these files need, so the first
 * diffs shown don't wait on them.
 */
async function preloadHighlighting(paths: string[]) {
  highlightPool();
  const langs = [...new Set(paths.map(getFiletypeFromFileName))].filter((lang) => lang !== 'text');
  await getSharedHighlighter({ themes: Object.values(DIFF_LOOK.theme), langs });
}

const api = { highlightPool, FileDiff, getLineAnnotationName, getSingularPatch, prepareContainer, highlightLines, preloadHighlighting };

export type DiffsApi = typeof api;

declare global {
  var __unmergedDiffs: DiffsApi | undefined;
}

export default defineUnlistedScript(() => {
  globalThis.__unmergedDiffs = api;
});
