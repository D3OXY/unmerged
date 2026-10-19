import { matchRoute } from './routes';

/** Whether Unmerged renders a URL. The app swaps in the content script's check, which also honors settings. */
let owns = (url: URL) => matchRoute(url) !== null;
export function setOwns(check: (url: URL) => boolean) {
  owns = check;
}

type Listener = (url: URL) => void;
const listeners = new Set<Listener>();

/** Subscribe to in-app navigations (our pushState calls and back/forward). */
export function onNavigate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitNavigate(url: URL) {
  for (const listener of listeners) listener(url);
}

/**
 * Navigate to a GitHub URL. Routes Unmerged owns are swapped in place without a reload;
 * everything else is a normal page load so GitHub renders it.
 *
 * Opening, switching or closing a list's side panel keeps the list where it was scrolled. Switching from one
 * pull request or issue to another replaces the history entry, so Back closes the panel.
 */
export function navigate(href: string) {
  const url = new URL(href, location.href);
  if (url.origin === location.origin && owns(url)) {
    const panelOnly = withPeek(url.href, null) === withPeek(location.href, null);
    const switching = panelOnly && url.searchParams.has('peek') && new URL(location.href).searchParams.has('peek');
    if (url.href !== location.href) history[switching ? 'replaceState' : 'pushState'](null, '', url);
    emitNavigate(url);
    if (!panelOnly) window.scrollTo(0, 0);
    return;
  }
  location.assign(url);
}

/** `href` with `path` (a pull request's or issue's page) open in the side panel, or with the panel closed. */
export function withPeek(href: string, path: string | null) {
  const url = new URL(href);
  if (path) url.searchParams.set('peek', path.replace(/^\//, ''));
  else url.searchParams.delete('peek');
  return url.href;
}

/** True when a click should be left to the browser (new tab, download, etc.). */
export function isModifiedClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
