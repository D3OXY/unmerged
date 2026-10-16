import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest resolves `@/` and `#imports` and fakes `browser` (storage included); happy-dom supplies
// DOMParser and localStorage.
export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'happy-dom' },
});
