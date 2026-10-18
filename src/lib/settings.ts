import { useEffect, useReducer, useState } from 'react';
import { browser, storage } from '#imports';
import { localCache } from './localCache';
import type { Route } from './routes';
import { DEFAULT_PALETTE, DEFAULT_THEME_ID, findTheme, paletteOf, type Colors, type Palette, type Theme } from './theme';

/** Surfaces Unmerged can take over. Each can be switched off from the popup. */
export type Surface = 'home' | 'profile' | 'pr' | 'issue' | 'commit' | 'compare' | 'repo' | 'work' | 'notifications' | 'run' | 'search';

export type Surfaces = Record<Surface, boolean>;

/** The switch a route's page is turned off with: its own, or that of the pages it belongs with. */
export function surfaceOf(route: Route): Surface {
  switch (route.kind) {
    case 'newIssue':
      return 'issue';
    case 'org':
      return 'profile';
    case 'branches':
    case 'contributors':
      return 'repo';
    default:
      return route.kind;
  }
}

/** GitHub token used for API calls. Kept in extension local storage and sent only to api.github.com. */
export const tokenItem = storage.defineItem<string>('local:token', { fallback: '' });

/**
 * Random id saved alongside the token and renewed whenever the token changes (see `saveToken` in persist.ts).
 * Cached data is filed under it, so another account's never shows. '' before the first change.
 */
export const accountItem = storage.defineItem<string>('local:account', { fallback: '' });

/** GitHub's "new token" page, prefilled with the scopes Unmerged uses. */
export const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Unmerged&scopes=repo,read:org,read:user,user:follow,notifications';

/** From github.com: opens Unmerged's settings page in a tab, where the token is entered (see background.ts). */
export function openSettingsPage() {
  browser.runtime.sendMessage('open-settings');
}

export const DEFAULT_SURFACES: Surfaces = { home: true, profile: true, pr: true, issue: true, commit: true, compare: true, repo: true, work: true, notifications: true, run: true, search: true };

export const surfacesItem = storage.defineItem<Surfaces>('local:surfaces', { fallback: DEFAULT_SURFACES });

/** Whether a list opens its pull requests and issues in a side panel instead of in place of the list. */
export const sidePanelItem = storage.defineItem<boolean>('local:sidePanel', { fallback: true });

/** Whether a repository's front page shows its last 12 weeks of activity (RepoPulse) above the files. */
export const repoPulseItem = storage.defineItem<boolean>('local:repoPulse', { fallback: true });

/** Whether a pull request that can merge now shows Slide to merge in the bottom-right corner, on every tab. */
export const slideToMergeItem = storage.defineItem<boolean>('local:slideToMerge', { fallback: true });

/** Light or dark. "auto" follows GitHub's own appearance setting, then the OS. Stored under its old name. */
export type Appearance = 'auto' | 'light' | 'dark';

export const appearanceItem = storage.defineItem<Appearance>('local:theme', { fallback: 'auto' });

/** The color theme: a preset's id or a custom theme's (see theme.ts). */
export const themeIdItem = storage.defineItem<string>('local:themeId', { fallback: DEFAULT_THEME_ID });

/** Themes made in settings, in the order they were made. */
export const customThemesItem = storage.defineItem<Theme[]>('local:customThemes', { fallback: [] });

/** Text font of the github.com UI, as in Notion: Geist, the system serif, or JetBrains Mono. Code stays in Geist Mono. */
export type Font = 'default' | 'serif' | 'mono';

export const fontItem = storage.defineItem<Font>('local:font', { fallback: 'default' });

/** Whether an appearance resolves to dark right now. Outside github.com (the popup) "auto" is just the OS. */
export function isDark(appearance: Appearance) {
  if (appearance !== 'auto') return appearance === 'dark';
  const mode = document.documentElement.dataset.colorMode;
  return mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}

/** Whether the dark theme is showing; follows the setting and, on "auto", the OS. */
export function useIsDark() {
  const appearance = useStorageItem(appearanceItem);
  const [, osChanged] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', osChanged);
    return () => query.removeEventListener('change', osChanged);
  }, []);
  return isDark(appearance ?? 'auto');
}

/**
 * Keeps a page in the chosen appearance and theme. `apply` runs at once with the values last mirrored in this
 * page's localStorage under `prefix` (so the first paint is right before extension storage answers), then
 * whenever the appearance, the theme, a custom theme or the OS changes. Returns a function that runs it again.
 */
export function followTheme(prefix: string, apply: (dark: boolean, colors: Colors) => void) {
  const appearanceCache = localCache<Appearance>(`${prefix}theme`);
  const paletteCache = localCache<Palette>(`${prefix}palette`);
  let appearance = appearanceCache.get() ?? 'auto';
  let palette = paletteCache.get() ?? DEFAULT_PALETTE;
  let themeId: string | undefined;
  let custom: Theme[] | undefined;

  const run = () => {
    const dark = isDark(appearance);
    apply(dark, palette[dark ? 'dark' : 'light']);
  };
  const setAppearance = (value: Appearance) => {
    appearance = value;
    appearanceCache.set(value);
    run();
  };
  const update = () => {
    if (themeId === undefined || custom === undefined) return;
    palette = paletteOf(findTheme(themeId, custom));
    paletteCache.set(palette);
    run();
  };

  run();
  appearanceItem.getValue().then(setAppearance);
  appearanceItem.watch(setAppearance);
  Promise.all([themeIdItem.getValue(), customThemesItem.getValue()]).then(([id, themes]) => {
    [themeId, custom] = [id, themes];
    update();
  });
  themeIdItem.watch((id) => {
    themeId = id;
    update();
  });
  customThemesItem.watch((themes) => {
    custom = themes;
    update();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', run);
  return run;
}

/** A local build loaded unpacked, not a store install (the store adds `update_url` to the manifest). */
export const isUnpacked = () => !('update_url' in browser.runtime.getManifest());

/** Pinned repos ("owner/name"), in sidebar order. Synced across the user's browsers. */
export const pinsItem = storage.defineItem<string[]>('sync:pinnedRepos', { fallback: [] });

type Item<T> = { getValue(): Promise<T>; watch(callback: (value: T) => void): () => void };

/** Live value of an extension storage item; null until the first read. Updates when any tab writes it. */
export function useStorageItem<T>(item: Item<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    item.getValue().then(setValue);
    return item.watch(setValue);
  }, [item]);
  return value;
}
