import { useEffect, useReducer, useState } from 'react';
import { storage } from '#imports';

/** Surfaces Unmerged can take over. Each can be switched off from the popup. */
export type Surface = 'home' | 'profile' | 'pr' | 'repo';

export type Surfaces = Record<Surface, boolean>;

/** GitHub token used for API calls. Stored only in extension local storage. */
export const tokenItem = storage.defineItem<string>('local:token', { fallback: '' });

/** GitHub's "new token" page, prefilled with the scopes Unmerged uses. */
export const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Unmerged&scopes=repo,read:org,read:user,user:follow,notifications';

export const surfacesItem = storage.defineItem<Surfaces>('local:surfaces', {
  fallback: { home: true, profile: true, pr: true, repo: true },
});

/** Color theme. "auto" follows GitHub's own appearance setting, then the OS. */
export type Theme = 'auto' | 'light' | 'dark';

export const themeItem = storage.defineItem<Theme>('local:theme', { fallback: 'auto' });

/** Whether a theme resolves to dark right now. Outside github.com (the popup) "auto" is just the OS. */
export function isDark(theme: Theme) {
  if (theme !== 'auto') return theme === 'dark';
  const mode = document.documentElement.dataset.colorMode;
  return mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}

/** Whether the dark theme is showing; follows the setting and, on "auto", the OS. */
export function useIsDark() {
  const theme = useStorageItem(themeItem);
  const [, osChanged] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', osChanged);
    return () => query.removeEventListener('change', osChanged);
  }, []);
  return isDark(theme ?? 'auto');
}

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
