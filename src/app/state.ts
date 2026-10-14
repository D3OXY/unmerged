import type { Route } from '@/lib/routes';
import { createStore } from '@/lib/store';

/** What the content script wants on screen: our page, or stock GitHub with a "back to Unmerged" pill. */
export type AppState = { mode: 'own'; route: Route } | { mode: 'classic' };

export const appState = createStore<AppState>({ mode: 'classic' });

/** Flipped when GitHub answers 401, so the token gate can ask for a new token. */
export const authRejected = createStore(false);
