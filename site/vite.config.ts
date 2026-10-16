import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { SITE_URL } from './src/site.ts';

// Every page is prerendered, so `dist/client` is the whole site and any static host can serve it.
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      prerender: { enabled: true, crawlLinks: true },
      sitemap: { enabled: true, host: SITE_URL },
    }),
    react(),
  ],
});
