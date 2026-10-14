import { matchRoute } from './routes';

/** Whether Unmerged renders a URL. The content script swaps in a check that also honors settings. */
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
 */
export function navigate(href: string) {
  const url = new URL(href, location.href);
  if (url.origin === location.origin && owns(url)) {
    if (url.href !== location.href) history.pushState(null, '', url);
    emitNavigate(url);
    window.scrollTo(0, 0);
    return;
  }
  location.assign(url);
}

/** True when a click should be left to the browser (new tab, download, etc.). */
export function isModifiedClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
