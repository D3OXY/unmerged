import { useEffect, useState } from 'react';
import { storage } from '#imports';

/** Surfaces Unmerged can take over. Each can be switched off from the popup. */
export type Surface = 'home' | 'profile' | 'pr' | 'repo';

export type Surfaces = Record<Surface, boolean>;

/** GitHub token used for API calls. Stored only in extension local storage. */
export const tokenItem = storage.defineItem<string>('local:token', { fallback: '' });

export const surfacesItem = storage.defineItem<Surfaces>('local:surfaces', {
  fallback: { home: true, profile: true, pr: true, repo: true },
});

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
