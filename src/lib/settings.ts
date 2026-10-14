import { storage } from '#imports';

/** Surfaces Unmerged can take over. Each can be switched off from the popup. */
export type Surface = 'home' | 'profile' | 'pr' | 'repo';

export type Surfaces = Record<Surface, boolean>;

/** GitHub token used for API calls. Stored only in extension local storage. */
export const tokenItem = storage.defineItem<string>('local:token', { fallback: '' });

export const surfacesItem = storage.defineItem<Surfaces>('local:surfaces', {
  fallback: { home: true, profile: true, pr: true, repo: true },
});
