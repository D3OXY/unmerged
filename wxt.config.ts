import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Unmerged',
    description: 'GitHub, as if it never got acquired. A calmer, faster skin for github.com.',
    permissions: ['storage'],
    host_permissions: ['https://api.github.com/*'],
    web_accessible_resources: [{ resources: ['fonts/*'], matches: ['https://github.com/*'] }],
  },
});
