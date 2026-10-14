import './style.css';
import { createRoot, type Root } from 'react-dom/client';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/app/App';
import { installKeyboard } from '@/app/keyboard';
import { appState, authRejected, type AppState } from '@/app/state';
import { AuthError } from '@/github/client';
import { loadFonts } from '@/lib/fonts';
import { classicPath, clearClassicUnless } from '@/lib/classic';
import { emitNavigate, isModifiedClick, navigate, onNavigate, setOwns } from '@/lib/navigation';
import { matchRoute, type Route } from '@/lib/routes';
import { sessionLogin } from '@/lib/session';
import { surfacesItem, type Surfaces } from '@/lib/settings';

const OWNING = 'unmerged-owning';

// Applied to github.com itself: hides GitHub's page while Unmerged owns the URL, before first paint.
const DOCUMENT_CSS = `
  html.${OWNING} > body { display: none !important; }
  html.${OWNING} { background: #fcfcfd; overflow-y: auto; scroll-behavior: auto !important; scroll-padding: 0 !important; }
  html.${OWNING}.unmerged-dark { background: #08090a; }
  unmerged-app { display: block; }
`;

function prefersDark() {
  const mode = document.documentElement.dataset.colorMode;
  return mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}

export default defineContentScript({
  matches: ['https://github.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const html = document.documentElement;
    const style = document.createElement('style');
    style.textContent = DOCUMENT_CSS;
    html.append(style);
    html.classList.toggle('unmerged-dark', prefersDark());

    let surfaces: Surfaces = { home: true, profile: true, pr: true, repo: true };
    let mounted = false;

    /** Decides, for a URL, whether Unmerged owns the page, shows the classic pill, or stays out of the way. */
    const resolve = (url: URL): { owning: boolean; route: Route } | null => {
      const route = matchRoute(url);
      // `?? true`: settings saved before a surface existed don't list it.
      if (!route || !(surfaces[route.kind] ?? true)) return null;
      // The logged-out homepage is GitHub's marketing site; leave it alone.
      if (route.kind === 'home' && sessionLogin() === '') return null;
      return { owning: classicPath() !== url.pathname, route };
    };
    setOwns((url) => !!resolve(url)?.owning);

    // Hide GitHub's page synchronously; mounting our UI is async (CSS load) and must not flash.
    html.classList.toggle(OWNING, !!resolve(new URL(location.href))?.owning);

    const ui = await createShadowRootUi(ctx, {
      name: 'unmerged-app',
      position: 'inline',
      anchor: 'html',
      append: 'last',
      isolateEvents: true,
      onMount(container) {
        container.classList.add('u-root');
        container.classList.toggle('dark', prefersDark());
        const queryClient = new QueryClient({
          defaultOptions: { queries: { refetchOnWindowFocus: true, retry: (n, err) => !(err instanceof AuthError) && n < 2 } },
          queryCache: new QueryCache({ onError: (err) => err instanceof AuthError && authRejected.set(true) }),
        });
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
    loadFonts();
    installKeyboard(ui.shadowHost, () => html.classList.contains(OWNING));

    surfacesItem.getValue().then((value) => {
      surfaces = value;
      sync(new URL(location.href));
    });
    surfacesItem.watch((value) => {
      surfaces = value;
      sync(new URL(location.href));
    });

    // Once <head> is parsed we know whether the user is signed in (matters for the homepage).
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => sync(new URL(location.href)), { once: true });
    }

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
    // must stay hidden until the next document replaces it, or it flashes.
    if (window.navigation) {
      window.navigation.addEventListener(
        'navigate',
        (event) => {
          if (event.destination.sameDocument) sync(new URL(event.destination.url));
        },
        { signal: ctx.signal },
      );
    } else {
      let last = location.href;
      ctx.setInterval(() => {
        if (location.href !== last) sync(new URL((last = location.href)));
      }, 250);
    }

    // Link clicks. Ours are always handled here so GitHub's Turbo never soft-navigates (and unhides) the
    // page underneath; GitHub's own links are taken over only when they lead to a page we own.
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
        navigate(url.href);
      },
      { capture: true },
    );
  },
});
