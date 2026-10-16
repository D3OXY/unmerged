// Stands in for the `shiki` package inside the diff renderer (aliased in wxt.config.ts). `@pierre/diffs`
// imports full Shiki, which would inline every grammar and theme (~11 MB) into the script. This keeps
// Shiki's core and loads each grammar on first use from the extension's `shiki-langs/` folder, a copy of
// `@shikijs/langs` (see wxt.config.ts).
import { createBundledHighlighter, createSingletonShorthands, guessEmbeddedLanguages, type LanguageRegistration } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { browser } from 'wxt/browser';

export * from 'shiki/core';
export { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

type Loader = () => Promise<{ default: LanguageRegistration[] }>;

const langsUrl = `${browser.runtime.getURL('/')}shiki-langs/`;
const loader = (id: string): Loader => () => import(/* @vite-ignore */ `${langsUrl}${id}.mjs`);

/**
 * Every Shiki language id (including aliases like `zsh` and `yml`) maps to a file of the same name, and
 * `@pierre/diffs` only asks for ids it inferred from Shiki's own list, so any id is answered.
 */
export const bundledLanguages = new Proxy<Record<string, Loader>>(
  {},
  {
    get: (_, id) => (typeof id === 'string' ? loader(id) : undefined),
    has: (_, id) => typeof id === 'string',
    getOwnPropertyDescriptor: (_, id) => (typeof id === 'string' ? { value: loader(id), configurable: true, enumerable: true } : undefined),
  },
);

// Themes come from `@pierre/theming`, which `@pierre/diffs` registers itself.
export const createHighlighter = createBundledHighlighter({ langs: bundledLanguages, themes: {}, engine: () => createJavaScriptRegexEngine() });

export const { codeToHtml } = createSingletonShorthands(createHighlighter, { guessEmbeddedLanguages });

/** Only used for `preferredHighlighter: 'shiki-wasm'`, which Unmerged never sets. */
export function createOnigurumaEngine(): never {
  throw new Error('Unmerged ships only the JavaScript regex engine');
}
