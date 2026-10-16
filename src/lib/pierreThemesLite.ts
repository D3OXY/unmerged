// Stands in for `@pierre/theming/themes` inside the diff renderer (aliased in wxt.config.ts). The real entry
// bundles every Shiki theme plus ten Pierre variants (~1.7 MB); Unmerged only uses Pierre Dark and Light.
import { createThemeCollection, type ThemeDescriptor } from '@pierre/theming';
import { normalizeTheme, type ThemeRegistrationAny } from 'shiki/core';

type ThemeModule = ThemeRegistrationAny | { default: ThemeRegistrationAny };

/** Same contract as `@pierre/theming`'s `createTheme` (used by `registerCustomTheme`): the loader may return a module. */
export function createTheme({ load, ...theme }: Omit<ThemeDescriptor, 'load'> & { load: () => Promise<ThemeModule> }): ThemeDescriptor {
  return {
    ...theme,
    load: async () => {
      const loaded = await load();
      return normalizeTheme('default' in loaded ? loaded.default : loaded);
    },
  };
}

type PierreTheme = typeof import('@pierre/theme/pierre-dark').default;

// Passes Shiki the fields it reads. (Pierre's frozen `tokenColors` is typed readonly, and its VS Code
// `semanticTokenColors` don't fit Shiki's type and aren't used for highlighting.)
const pierre = (name: string, colorScheme: 'light' | 'dark', load: () => Promise<{ default: PierreTheme }>) =>
  createTheme({
    name,
    colorScheme,
    collection: 'pierre',
    load: async () => {
      const { default: theme } = await load();
      return { name: theme.name, displayName: theme.displayName, type: theme.type, colors: theme.colors, tokenColors: [...theme.tokenColors] };
    },
  });

export const pierreThemes = createThemeCollection({
  themes: [pierre('pierre-dark', 'dark', () => import('@pierre/theme/pierre-dark')), pierre('pierre-light', 'light', () => import('@pierre/theme/pierre-light'))],
});

/** Shiki's own themes, which Unmerged doesn't offer. */
export const shikiThemes = createThemeCollection({ themes: [] });
