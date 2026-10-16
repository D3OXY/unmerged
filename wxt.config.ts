import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
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
  manifest: {
    name: 'Unmerged',
    description: 'GitHub, as if it never got acquired. A calmer, faster skin for github.com.',
    permissions: ['storage'],
    host_permissions: ['https://api.github.com/*'],
    web_accessible_resources: [{ resources: ['fonts/*', 'diffs.js', 'shiki-langs/*'], matches: ['https://github.com/*'] }],
  },
});
