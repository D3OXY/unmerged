import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Correctness only: Hooks rules plus typescript-eslint's recommended set. Formatting is left alone.
export default defineConfig(
  { ignores: ['.output', '.wxt', 'site/dist', 'site/.tanstack', 'site/src/routeTree.gen.ts'] },
  tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // A warning until FileFinder's key handler stops using comma expressions.
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
);
