import './style.css';
import { createRoot, type Root } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/app/App';
import { prefetchRoute } from '@/app/prefetch';
import { installKeyboard } from '@/app/keyboard';
import { appState, authRejected, onApiError, type AppState } from '@/app/state';
import { GitHubError } from '@/github/client';
import { loadFonts } from '@/lib/fonts';
import { classicPath, clearClassicUnless } from '@/lib/classic';
import { emitNavigate, isModifiedClick, navigate, onNavigate, setOwns, withPeek } from '@/lib/navigation';
import { matchRoute, type Route } from '@/lib/routes';
import { sessionLogin } from '@/lib/session';
import { localCache, setPageAccount } from '@/lib/localCache';
import { trimPersisted } from '@/lib/persist';
import { accountItem, DEFAULT_SURFACES, isDark, surfacesItem, themeItem, type Surfaces, type Theme } from '@/lib/settings';

const OWNING = 'unmerged-owning';

// Applied to github.com itself: hides GitHub's page while Unmerged owns the URL, before first paint.
const DOCUMENT_CSS = `
  html.${OWNING} > body { display: none !important; }
  html.${OWNING} { background: #fcfcfd; overflow-y: auto; scroll-behavior: auto !important; scroll-padding: 0 !important; }
  html.${OWNING}.unmerged-dark { background: #08090a; }
  unmerged-app { display: block; }
`;

// Mirrors of settings in github.com's localStorage, read synchronously before extension storage answers.
const themeCache = localCache<Theme>('unmerged:theme');
const surfacesCache = localCache<Surfaces>('unmerged:surfaces');
const TRIMMED_KEY = 'unmerged:trimmed-at';

export default defineContentScript({
  matches: ['https://github.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const html = document.documentElement;
    // Read now, applied before anything renders: API data cached in the page must be this account's.
    const account = accountItem.getValue();
    const style = document.createElement('style');
    style.textContent = DOCUMENT_CSS;
    html.append(style);

    let theme = themeCache.get() ?? 'auto';
    let container: HTMLElement | undefined;
    const applyTheme = () => {
      const dark = isDark(theme);
      html.classList.toggle('unmerged-dark', dark);
      container?.classList.toggle('dark', dark);
    };
    const setTheme = (value: Theme) => {
      theme = value;
      themeCache.set(value);
      applyTheme();
    };
    applyTheme();
    themeItem.getValue().then(setTheme);
    themeItem.watch(setTheme);
    ctx.addEventListener(matchMedia('(prefers-color-scheme: dark)'), 'change', applyTheme);

    // Mirrored like the theme: the first decision below has to be right before extension storage answers.
    let surfaces: Surfaces = surfacesCache.get() ?? DEFAULT_SURFACES;
    let mounted = false;

    /** Decides, for a URL, whether Unmerged owns the page, shows the classic pill, or stays out of the way. */
    const resolve = (url: URL): { owning: boolean; route: Route } | null => {
      const route = matchRoute(url);
      // `?? true`: settings saved before a surface existed don't list it. New issues go with issues, organizations
      // with profiles.
      if (!route || !(surfaces[route.kind === 'newIssue' ? 'issue' : route.kind === 'org' ? 'profile' : route.kind] ?? true)) return null;
      // The logged-out homepage is GitHub's marketing site; leave it alone.
      if (route.kind === 'home' && sessionLogin() === '') return null;
      return { owning: classicPath() !== url.pathname, route };
    };
    setOwns((url) => !!resolve(url)?.owning);

    // Hide GitHub's page synchronously; mounting our UI is async (CSS load) and must not flash.
    const initial = resolve(new URL(location.href));
    html.classList.toggle(OWNING, !!initial?.owning);

    // GitHub's page under ours is never shown, yet it would download (~1 MB of HTML on a repo page) and run
    // its scripts, competing with ours. Its <head> has what we need (who's signed in, title, icon), so once
    // the body starts, stop the rest. `window.stop()` also cancels requests already in flight, ours included,
    // so on a page we own nothing of ours starts before it; the head arrives right after the response
    // starts, about when this script runs anyway. Leaving our pages for one of GitHub's reloads (see sync).
    let stopped = false;
    const headParsed = new Promise<void>((done) => {
      if (document.body) return done();
      const observer = new MutationObserver(() => {
        if (!document.body) return;
        observer.disconnect();
        done();
      });
      observer.observe(html, { childList: true });
    });
    if (initial?.owning) {
      await headParsed;
      if (resolve(new URL(location.href))?.owning) {
        window.stop();
        stopped = true;
      }
    }

    // Made before the UI so the page's requests start now, not after React and our styles are ready.
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
    const start = resolve(new URL(location.href));
    if (start?.owning) prefetchRoute(queryClient, start.route, new URL(location.href));

    setPageAccount(await account);
    // A new token or Disconnect (in the settings page): everything this tab holds is the old account's.
    accountItem.watch((id) => {
      setPageAccount(id);
      if (html.classList.contains(OWNING)) return location.reload();
      queryClient.clear();
      authRejected.set(false);
    });

    const ui = await createShadowRootUi(ctx, {
      name: 'unmerged-app',
      position: 'inline',
      anchor: 'html',
      append: 'last',
      isolateEvents: true,
      onMount(element) {
        loadFonts();
        container = element;
        container.classList.add('u-root');
        applyTheme();
        const root = createRoot(container);
        root.render(
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>,
        );
        return root;
      },
      onRemove: (root?: Root) => root?.unmount(),
    });

    const sync = (url: URL) => {
      clearClassicUnless(url.pathname);
      const result = resolve(url);
      // GitHub's own page was never loaded; get it now.
      if (stopped && !result?.owning) return location.reload();
      html.classList.toggle(OWNING, !!result?.owning);
      if (!result) {
        if (mounted) ui.remove();
        mounted = false;
        return;
      }
      const next: AppState = result.owning ? { mode: 'own', route: result.route } : { mode: 'classic' };
      // Hash changes and repeated events resolve to the same state; skip the re-render.
      if (JSON.stringify(next) !== JSON.stringify(appState.get())) appState.set(next);
      if (!mounted) ui.mount();
      mounted = true;
    };

    sync(new URL(location.href));
    installKeyboard(ui.shadowHost, () => html.classList.contains(OWNING));

    const setSurfaces = (value: Surfaces) => {
      surfaces = value;
      surfacesCache.set(value);
      sync(new URL(location.href));
    };
    surfacesItem.getValue().then(setSurfaces);
    surfacesItem.watch(setSurfaces);

    // Once <head> is parsed we know whether the user is signed in (matters for the homepage).
    headParsed.then(() => sync(new URL(location.href)));

    // Our own pushState navigations, back/forward, and GitHub's soft navigations.
    onNavigate(sync);
    // Back/forward onto a page we own: claim it before GitHub's router (registered after us) tries a
    // restoration visit, which would otherwise reload the page.
    ctx.addEventListener(
      window,
      'popstate',
      (event) => {
        const url = new URL(location.href);
        if (resolve(url)?.owning) event.stopImmediatePropagation();
        emitNavigate(url);
      },
      { capture: true },
    );
    // GitHub's soft navigations. Only same-document ones: during a full page load the page being left
    // must stay hidden until the next document replaces it, or it flashes. Not back/forward, which popstate
    // handles once the URL has changed: rendering a page before then, while `location` is still the old
    // one, lets a page's replaceState (a list's ?q=) cancel the traversal.
    if (window.navigation) {
      window.navigation.addEventListener(
        'navigate',
        (event) => {
          if (event.destination.sameDocument && event.navigationType !== 'traverse') sync(new URL(event.destination.url));
        },
        { signal: ctx.signal },
      );
    } else {
      let last = location.href;
      ctx.setInterval(() => {
        if (location.href !== last) sync(new URL((last = location.href)));
      }, 250);
    }

    // Prefetch what a link to one of our pages will show: on a short hover (not on every pass of the mouse),
    // on keyboard focus (j/k), and on press, ~100 ms before the click itself.
    // (The link is looked up while the event dispatches: `composedPath()` is empty afterwards.)
    const linkTarget = (event: Event) => {
      const anchor = event.composedPath().find((el) => el instanceof HTMLAnchorElement);
      if (!anchor?.href) return;
      const url = new URL(anchor.href);
      const target = url.origin === location.origin && url.href !== location.href ? resolve(url) : null;
      return target?.owning ? () => prefetchRoute(queryClient, target.route, url) : undefined;
    };
    let hover: ReturnType<typeof setTimeout> | undefined;
    ctx.addEventListener(document, 'pointerover', (event) => {
      clearTimeout(hover);
      const prefetch = linkTarget(event);
      if (prefetch) hover = setTimeout(prefetch, 60);
    });
    ctx.addEventListener(document, 'pointerout', () => clearTimeout(hover));
    ctx.addEventListener(document, 'pointerdown', (event) => linkTarget(event)?.(), { capture: true });
    ctx.addEventListener(document, 'focusin', (event) => linkTarget(event)?.());

    // Once a day, while idle, drop old cached query results.
    if (Date.now() - Number(localStorage.getItem(TRIMMED_KEY)) > 86_400_000) {
      requestIdleCallback(() => {
        localStorage.setItem(TRIMMED_KEY, String(Date.now()));
        trimPersisted();
      });
    }

    // Link clicks. Ours are always handled here so GitHub's Turbo never soft-navigates (and unhides) the
    // page underneath; GitHub's own links are taken over only when they lead to a page we own. A link marked
    // `data-peek` (a list row, a tab inside the side panel) opens its page in the side panel instead, if
    // that page is one we own.
    ctx.addEventListener(
      document,
      'click',
      (event) => {
        const path = event.composedPath();
        // A button inside a link (e.g. unpin ×) handles its own click.
        const control = path.find((el) => el instanceof HTMLAnchorElement || el instanceof HTMLButtonElement);
        const anchor = control instanceof HTMLAnchorElement ? control : undefined;
        if (!anchor || event.defaultPrevented || isModifiedClick(event) || anchor.target || anchor.hasAttribute('download')) return;
        const url = new URL(anchor.href);
        if (url.origin !== location.origin) return;
        if (!path.includes(ui.shadowHost) && !resolve(url)?.owning) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate(anchor.dataset.peek && resolve(url)?.owning ? withPeek(location.href, url.pathname) : url.href);
      },
      { capture: true },
    );
  },
});
