import { browser } from 'wxt/browser';

// The boot page. On a full load of an owned page, GitHub builds that page's HTML (0.4–8 s) before it sends a
// byte, and Unmerged stops it after <head>. So a redirect rule (bootRules.ts) loads a GitHub 404 page instead,
// /site/unmerged-boot/<the real path and query>: GitHub sends it in ~200 ms, and its <head> has all Unmerged
// reads (who is signed in, data-color-mode, the icon). The content script puts the real URL back at
// document_start (`bootTarget`), and the page runs as usual. When it decides that the URL is GitHub's page after
// all (Classic, the signed-out homepage, a rule that matches more than `matchRoute`), the background lets the tab
// load that URL past the redirect (`reloadOnGitHub`).

export const BOOT_PATH = '/site/unmerged-boot';

/** The real URL (path, query and fragment) that a boot page at `url` stands in for, or null if it isn't one. */
export function bootTarget(url: URL): string | null {
  return url.pathname.startsWith(`${BOOT_PATH}/`) ? url.pathname.slice(BOOT_PATH.length) + url.search + url.hash : null;
}

// The URL that `reloadOnGitHub` last reloaded on GitHub's page, in this tab.
const RELOADED = 'unmerged:github-page';

/** Asks the background to let this tab load `url` as GitHub's page (null: as Unmerged's again). */
const letTabLoad = (url: string | null) => browser.runtime.sendMessage({ type: 'github-page', url }).catch(() => {});

/** Reloads the tab on GitHub's own page for the current URL, past the boot redirect. */
export async function reloadOnGitHub() {
  const url = new URL(location.href);
  url.hash = ''; // Requests carry no fragment.
  await letTabLoad(url.href);
  sessionStorage.setItem(RELOADED, location.href);
  location.reload();
}

/** Reloads the tab on Unmerged's page for the current URL: the background drops the tab's way to GitHub's page. */
export async function reloadOnUnmerged() {
  await letTabLoad(null);
  location.reload();
}

/**
 * Whether `reloadOnGitHub` reloaded this document's URL. Read once at document_start: a boot page for that URL
 * means the way past the redirect failed, and reloading again would loop.
 */
export function reloadedOnGitHub() {
  const reloaded = sessionStorage.getItem(RELOADED) === location.href;
  sessionStorage.removeItem(RELOADED);
  return reloaded;
}

/** The background's half of `reloadOnGitHub` and `reloadOnUnmerged`: the URL (or null), or undefined for any other message. */
export function githubPageRequest(message: unknown): string | null | undefined {
  if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'github-page') return;
  if (!('url' in message)) return;
  return typeof message.url === 'string' ? message.url : null;
}
