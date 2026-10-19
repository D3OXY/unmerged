import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    // The highlighting worker (src/entrypoints/highlighter/worker.ts) only imports @pierre/diffs's worker
    // script, which the package marks side-effect free like all its files. This keeps it in the bundle.
    worker: {
      plugins: () => [
        {
          name: 'keep-pierre-worker',
          transform: { filter: { id: /@pierre\/diffs\/dist\/worker\/worker\.js$/ }, handler: (code: string) => ({ code, moduleSideEffects: true }) },
        },
      ],
    },
    resolve: {
      alias: [
        // Slim Shiki for @pierre/diffs; see src/lib/shikiLite.ts.
        { find: /^shiki$/, replacement: resolve(import.meta.dirname, 'src/lib/shikiLite.ts') },
        { find: /^shiki\/wasm$/, replacement: resolve(import.meta.dirname, 'src/lib/shikiWasmStub.ts') },
        { find: /^@pierre\/theming\/themes$/, replacement: resolve(import.meta.dirname, 'src/lib/pierreThemesLite.ts') },
        { find: /^@pierre\/diffs\/style$/, replacement: resolve(import.meta.dirname, 'node_modules/@pierre/diffs/dist/style.js') },
      ],
    },
  }),
  hooks: {
    // Shiki grammars, loaded one at a time by the diff renderer (src/lib/shikiLite.ts).
    'build:publicAssets': (_, files) => {
      const langs = resolve(import.meta.dirname, 'node_modules/@shikijs/langs/dist');
      for (const name of readdirSync(langs)) {
        if (name.endsWith('.mjs')) files.push({ absoluteSrc: resolve(langs, name), relativeDest: `shiki-langs/${name}` });
      }
    },
  },
  manifest: ({ browser }) => ({
    name: 'Unmerged',
    description: 'GitHub, as if it never got acquired. A calmer, faster skin for github.com.',
    // unlimitedStorage: the query cache (src/lib/persist.ts) can outgrow the default 10 MB; it shows no prompt.
    // webRequest and github.com: the background sees a tab start to load a github.com page and starts its
    // requests then (src/github/early.ts). Neither adds an install warning: the content script already runs there.
    permissions: ['storage', 'unlimitedStorage', 'webRequest'],
    host_permissions: ['https://api.github.com/*', 'https://github.com/*'],
    web_accessible_resources: [{ resources: ['fonts/*', 'diffs.js', 'shiki-langs/*', 'player.html', 'highlighter.html'], matches: ['https://github.com/*'] }],
    // Firefox only: Chrome warns about the key. The id can't change once the add-on is on AMO. Data only goes
    // to GitHub, so the extension declares no data collection; 140 is the first Firefox that asks.
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: 'unmerged@deoxy.dev', strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
      },
    }),
  }),
});
