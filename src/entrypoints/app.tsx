// Unmerged's UI: React, the pages and their queries. The content script (src/entrypoints/github.content) loads
// it from the package only when a page needs it (an owned page, Classic's pill, or a link to an owned page that
// the user points at), so GitHub's other pages don't parse or run it. Runs in the content script's isolated
// world, so the two share globals.
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/app/App';
import { installKeyboard } from '@/app/keyboard';
import { prefetchRoute } from '@/app/prefetch';
import { appState, authRejected, onApiError, type AppState } from '@/app/state';
import { GitHubError } from '@/github/client';
import { takeEarlyAnswers } from '@/github/early';
import { preloadCode } from '@/lib/diffs';
import { loadFonts } from '@/lib/fonts';
import { localCache } from '@/lib/localCache';
import { emitNavigate, navigate, onNavigate, setOwns } from '@/lib/navigation';
import { trimPersisted, watchLocalEdits, type Seed } from '@/lib/persist';
import type { Route } from '@/lib/routes';
import { accountItem, blurredKinds, DEFAULT_PRIVACY, fontItem, privacyItem, type Font, type Privacy } from '@/lib/settings';

// Mirrors of settings in github.com's localStorage, read synchronously before extension storage answers.
const fontCache = localCache<Font>('unmerged:font');
const blurCache = localCache<string>('unmerged:blur');
const TRIMMED_KEY = 'unmerged:trimmed-at';

/** What the content script gives the app when it starts. */
type Boot = {
  /** The shadow root's host, which our UI renders in. */
  host: HTMLElement;
  /** Stored results that the first render shows: the sidebar's (see `readPersisted`). */
  seeds: Seed[];
  owns: (url: URL) => boolean;
  /** Whether our page is showing (GitHub's is hidden) now. */
  isOwning: () => boolean;
  /** Shows what a URL resolves to: our page, Classic's pill, or GitHub's page. */
  sync: (url: URL) => void;
};

/** Starts the app once per page; the content script calls what it returns. */
function start({ host, seeds, owns, isOwning, sync }: Boot) {
  // The background may have started the first requests already (see github/early.ts).
  takeEarlyAnswers();
  setOwns(owns);
  // Unmerged 0.1.1 and earlier kept the sidebar's API data in github.com's localStorage, where the page's scripts
  // can read it. Remove it.
  for (const key of ['unmerged:viewer', 'unmerged:recent-repos', 'unmerged:account']) localStorage.removeItem(key);

  // Only network failures and 5xx are retried: a 4xx (or a GraphQL error) would answer the same again.
  // Mutations run even while queries are paused for a rate limit (see onApiError), so an action fails
  // with the reason instead of firing by itself once the limit resets.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: (n, err) => !(err instanceof GitHubError && err.status < 500) && n < 2 },
      mutations: { networkMode: 'always' },
    },
    queryCache: new QueryCache({ onError: onApiError }),
    mutationCache: new MutationCache({ onError: onApiError }),
  });
  // Dated when GitHub last confirmed each, so the queries' `staleTime` holds across page loads.
  for (const { queryKey, data, checked } of seeds) queryClient.setQueryData(queryKey, data, { updatedAt: checked });
  watchLocalEdits(queryClient.getQueryCache());

  // A new token or Disconnect (in the settings page): everything this tab holds is the old account's.
  accountItem.watch(() => {
    if (isOwning()) return location.reload();
    queryClient.clear();
    authRejected.set(false);
  });

  let container: HTMLElement | undefined;
  let font = fontCache.get() ?? 'default';
  const applyFont = () => {
    if (container) container.dataset.font = font;
  };
  const setFont = (value: Font) => {
    font = value;
    fontCache.set(value);
    applyFont();
  };
  fontItem.getValue().then(setFont);
  fontItem.watch(setFont);

  // Privacy's kinds, as `data-blur` on the root (see github.content/style.css). Mirrored too, so private details never flash.
  let blur = blurCache.get() ?? blurredKinds(DEFAULT_PRIVACY).join(' ');
  const applyBlur = () => {
    if (container) container.dataset.blur = blur;
  };
  const setPrivacy = (value: Privacy) => {
    blur = blurredKinds(value).join(' ');
    blurCache.set(blur);
    applyBlur();
  };
  privacyItem.getValue().then(setPrivacy);
  privacyItem.watch(setPrivacy);

  // Our own pushState navigations and back/forward.
  onNavigate(sync);
  installKeyboard(host, isOwning);

  // Once a day, while idle, drop old cached query results.
  if (Date.now() - Number(localStorage.getItem(TRIMMED_KEY)) > 86_400_000) {
    requestIdleCallback(() => {
      localStorage.setItem(TRIMMED_KEY, String(Date.now()));
      trimPersisted();
    });
  }

  return {
    /** Renders our UI into the shadow root's container; returns what removes it. */
    render(element: HTMLElement) {
      loadFonts();
      container = element;
      applyFont();
      applyBlur();
      const root = createRoot(element);
      root.render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>,
      );
      return () => root.unmount();
    },
    show(next: AppState) {
      // Hash changes and repeated events resolve to the same state; skip the re-render.
      if (JSON.stringify(next) !== JSON.stringify(appState.get())) appState.set(next);
    },
    /** A page's requests and, for a page of code, what it draws with. */
    prefetch(route: Route, url: URL) {
      prefetchRoute(queryClient, route, url);
      preloadCode(route);
    },
    navigate,
    emitNavigate,
  };
}

export type AppApi = ReturnType<typeof start>;

declare global {
  var __unmergedApp: typeof start | undefined;
}

export default defineUnlistedScript(() => {
  globalThis.__unmergedApp = start;
});
