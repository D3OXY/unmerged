import './style.css';
import type { ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { AppApi } from '@/entrypoints/app';
import { prefetchInBackground } from '@/github/early';
import { bootTarget, reloadedOnGitHub, reloadOnGitHub } from '@/lib/boot';
import { classicPath, clearClassicUnless } from '@/lib/classic';
import { isModifiedClick, withPeek } from '@/lib/navigation';
import { matchRoute, type Route } from '@/lib/routes';
import { sessionLogin } from '@/lib/session';
import { localCache } from '@/lib/localCache';
import { readPersisted, recentReposKey, viewerKey } from '@/lib/persist';
import { accountItem, DEFAULT_SURFACES, followTheme, surfaceOf, surfacesItem, type Surfaces } from '@/lib/settings';
import { paintPalette } from '@/lib/theme';

// Runs on every github.com page, so it holds only what must run at document_start: which page this is, hiding
// GitHub's page, the shadow root, and the events that lead to one of our pages. Our UI (src/entrypoints/app.tsx)
// is loaded from the package only when a page needs it. The two are separate bundles: a module that both import
// is copied into each, so state that both must see (navigation's listeners, the query client) lives in the app.

const OWNING = 'unmerged-owning';

// Applied to github.com itself: hides GitHub's page while Unmerged owns the URL, before first paint, on the
// theme's background.
const documentCss = (background: string) => `
  html.${OWNING} > body { display: none !important; }
  html.${OWNING} { background: ${background}; overflow-y: auto; scroll-behavior: auto !important; scroll-padding: 0 !important; }
  unmerged-app { display: block; }
`;

// A mirror of the surfaces in github.com's localStorage, read synchronously before extension storage answers
// (the theme's are kept by `followTheme`).
const surfacesCache = localCache<Surfaces>('unmerged:surfaces');

/** Imports our UI's script from the package, as `loadDiffs` loads the code renderer. */
function loadApp() {
  return import(/* @vite-ignore */ browser.runtime.getURL('/app.js')).then(() => {
    if (!globalThis.__unmergedApp) throw new Error('Unmerged failed to load');
    return globalThis.__unmergedApp;
  });
}

export default defineContentScript({
  matches: ['https://github.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const html = document.documentElement;
    // A full load of an owned page arrives on the boot page (lib/boot.ts): put the real URL back before
    // anything reads it, and a neutral title before the 404 page's ("Page not found") is parsed. The first
    // <title> in the document is the one the tab shows and the app later sets.
    const boot = bootTarget(new URL(location.href));
    if (boot) {
      history.replaceState(null, '', boot);
      html.append(Object.assign(document.createElement('title'), { textContent: 'GitHub' }));
    }
    const reloaded = reloadedOnGitHub();
    // Read now, in parallel with loading the app: the account, then the sidebar's stored results, which the app
    // shows on its first render.
    const account = accountItem.getValue();
    const seeds = account.then((id) => readPersisted(id, [viewerKey, recentReposKey])).catch(() => []);
    const style = document.createElement('style');
    html.append(style);

    let container: HTMLElement | undefined;
    const applyTheme = followTheme('unmerged:', (dark, colors) => {
      style.textContent = documentCss(colors.bg);
      if (!container) return;
      container.classList.toggle('dark', dark);
      paintPalette(container, colors);
    });

    // Mirrored like the theme: the first decision below has to be right before extension storage answers.
    let surfaces: Surfaces = surfacesCache.get() ?? DEFAULT_SURFACES;

    /** Decides, for a URL, whether Unmerged owns the page, shows the classic pill, or stays out of the way. */
    const resolve = (url: URL): { owning: boolean; route: Route } | null => {
      const route = matchRoute(url);
      // `?? true`: settings saved before a surface existed don't list it.
      if (!route || !(surfaces[surfaceOf(route)] ?? true)) return null;
      // The logged-out homepage is GitHub's marketing site; leave it alone.
      if (route.kind === 'home' && sessionLogin() === '') return null;
      return { owning: classicPath() !== url.pathname, route };
    };
    const isOwning = () => html.classList.contains(OWNING);

    // Hide GitHub's page synchronously; mounting our UI is async (it loads with its CSS) and must not flash.
    // The boot page is never shown: if the URL is GitHub's after all, the tab reloads on GitHub's page (see sync).
    const initial = resolve(new URL(location.href));
    html.classList.toggle(OWNING, !!initial?.owning || !!boot);

    // GitHub's page under ours is never shown, yet it would download (~1 MB of HTML on a repo page) and run
    // its scripts, competing with ours. Its <head> has what we need (who's signed in, title, icon), so once
    // the body starts, stop the rest. `window.stop()` also cancels requests already in flight, ours included
    // (loading the app too), so on a page we own nothing of ours starts before it; the head arrives right
    // after the response starts, about when this script runs anyway. The background started the page's first
    // requests when the navigation started, and the page takes their answers (see github/early.ts). Leaving
    // our pages for one of GitHub's reloads (see sync).
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

    // The app and the shadow root it renders in, made together the first time a page needs them.
    let shell: { app: AppApi; ui: ShadowRootContentScriptUi<() => void> } | undefined;
    let loading: Promise<NonNullable<typeof shell>> | undefined;
    const load = () => {
      loading ??= (async () => {
        const [start, ui, seeded] = await Promise.all([
          loadApp(),
          createShadowRootUi(ctx, {
            name: 'unmerged-app',
            position: 'inline',
            anchor: 'html',
            append: 'last',
            isolateEvents: true,
            onMount(element): () => void {
              container = element;
              container.classList.add('u-root');
              applyTheme();
              return app.render(element);
            },
            onRemove: (unmount?: () => void) => unmount?.(),
          }),
          seeds,
        ]);
        const app = start({ host: ui.shadowHost, seeds: seeded, owns: (url) => !!resolve(url)?.owning, isOwning, sync });
        // The page's requests start now, not after React has rendered.
        const url = new URL(location.href);
        const page = resolve(url);
        if (page?.owning) app.prefetch(page.route, url);
        return (shell = { app, ui });
      })();
      loading.catch(() => (loading = undefined));
      return loading;
    };

    let mounted = false;
    let latest = new URL(location.href);
    const sync = (url: URL) => {
      latest = url;
      clearClassicUnless(url.pathname);
      const result = resolve(url);
      // GitHub's own page was never loaded; get it now. If this boot page is that reload's, the way past the
      // redirect failed: show its 404 page rather than reload again.
      if ((stopped || boot) && !result?.owning) {
        if (boot && reloaded) html.classList.remove(OWNING);
        else reloadOnGitHub();
        return;
      }
      html.classList.toggle(OWNING, !!result?.owning);
      if (!shell) {
        // Shown once the app has loaded, at the URL that is current by then.
        if (result) load().then(() => sync(latest));
        return;
      }
      if (!result) {
        if (mounted) shell.ui.remove();
        mounted = false;
        return;
      }
      shell.app.show(result.owning ? { mode: 'own', route: result.route } : { mode: 'classic' });
      if (!mounted) shell.ui.mount();
      mounted = true;
    };

    sync(new URL(location.href));

    const setSurfaces = (value: Surfaces) => {
      surfaces = value;
      surfacesCache.set(value);
      sync(new URL(location.href));
    };
    surfacesItem.getValue().then(setSurfaces);
    surfacesItem.watch(setSurfaces);

    // Once <head> is parsed we know whether the user is signed in (matters for the homepage).
    headParsed.then(() => sync(new URL(location.href)));

    // Back/forward onto a page we own: claim it before GitHub's router (registered after us) tries a
    // restoration visit, which would otherwise reload the page. The app's navigation listeners (and sync among
    // them) see it once it has loaded.
    ctx.addEventListener(
      window,
      'popstate',
      (event) => {
        const url = new URL(location.href);
        if (resolve(url)?.owning) event.stopImmediatePropagation();
        if (shell) shell.app.emitNavigate(url);
        else sync(url);
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
    // on keyboard focus (j/k), and on press, ~100 ms before the click itself. On GitHub's pages this is what
    // loads the app; the background starts the page's requests meanwhile.
    // (The link is looked up while the event dispatches: `composedPath()` is empty afterwards.)
    const prefetch = (route: Route, url: URL) => {
      if (shell) return shell.app.prefetch(route, url);
      // Only for the link that starts the load: links after it wait for the app, which is about to start.
      if (!loading) prefetchInBackground(url);
      load().then(({ app }) => app.prefetch(route, url));
    };
    const linkTarget = (event: Event) => {
      const anchor = event.composedPath().find((el) => el instanceof HTMLAnchorElement);
      if (!anchor?.href) return;
      const url = new URL(anchor.href);
      const target = url.origin === location.origin && url.href !== location.href ? resolve(url) : null;
      return target?.owning ? () => prefetch(target.route, url) : undefined;
    };
    let hover: ReturnType<typeof setTimeout> | undefined;
    ctx.addEventListener(document, 'pointerover', (event) => {
      clearTimeout(hover);
      const start = linkTarget(event);
      if (start) hover = setTimeout(start, 60);
    });
    ctx.addEventListener(document, 'pointerout', () => clearTimeout(hover));
    ctx.addEventListener(document, 'pointerdown', (event) => linkTarget(event)?.(), { capture: true });
    ctx.addEventListener(document, 'focusin', (event) => linkTarget(event)?.());

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
        if (!(shell && path.includes(shell.ui.shadowHost)) && !resolve(url)?.owning) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const href = anchor.dataset.peek && resolve(url)?.owning ? withPeek(location.href, url.pathname) : url.href;
        load().then(({ app }) => app.navigate(href));
      },
      { capture: true },
    );

    // Double-clicking a `data-peek` link opens its page full screen: the first click has already opened the
    // side panel (and prefetched it), the second goes to the page. It doesn't select a word of the title.
    const peekLink = (event: Event) =>
      event.composedPath().find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement && !!el.dataset.peek);
    ctx.addEventListener(document, 'mousedown', (event) => {
      if (event.detail > 1 && peekLink(event)) event.preventDefault();
    });
    ctx.addEventListener(document, 'dblclick', (event) => {
      const anchor = peekLink(event);
      if (anchor && !isModifiedClick(event) && resolve(new URL(anchor.href))?.owning) shell?.app.navigate(anchor.href);
    });
  },
});
