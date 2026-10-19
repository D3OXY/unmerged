import { QueryClient } from '@tanstack/react-query';
import { prefetchRoute } from '@/app/prefetch';
import { answerCodeSearch } from '@/github/client';
import { answerEarly, keepEarlyAnswers } from '@/github/early';
import { matchRoute } from '@/lib/routes';
import { surfaceOf, surfacesItem } from '@/lib/settings';

// Content scripts can't reload the extension or open its pages; github.com asks here (see SettingsDialog
// and openSettingsPage in lib/settings.ts). Code search, which github.com can't read, is fetched here too,
// and so are an owned page's first requests (see github/early.ts).
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message === 'reload') browser.runtime.reload();
    if (message === 'open-settings') browser.runtime.openOptionsPage();
    const answer = answerCodeSearch(message) ?? answerEarly(message);
    if (!answer) return;
    answer.then(sendResponse);
    return true; // Answers asynchronously.
  });

  // A tab starts to load a github.com page: if it's one we own, its requests start now, while GitHub's server
  // is still answering, and the page takes their answers when it runs.
  keepEarlyAnswers();
  browser.webRequest.onBeforeRequest.addListener(
    ({ url, tabId }) => {
      if (tabId >= 0) prefetchEarly(new URL(url));
    },
    { urls: ['https://github.com/*'], types: ['main_frame'] },
  );

  // Query results stored before the per-account index (lib/persist.ts) were keyed `q:<token suffix>:…` and
  // nothing trims them any more. Dropped on the update that brings the index; later updates find none.
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== 'update') return;
    const legacy = Object.keys(await browser.storage.local.get(null)).filter((key) => key.startsWith('q:'));
    if (legacy.length) await browser.storage.local.remove(legacy);
  });
});

/**
 * Starts the requests of the page at `url` if Unmerged owns it. The background can't see two cases where the
 * content script leaves the page to GitHub, and then starts requests that no page takes: a tab showing that
 * path in Classic, and the homepage while signed out of github.com.
 */
async function prefetchEarly(url: URL) {
  const route = matchRoute(url);
  if (!route || !((await surfacesItem.getValue())[surfaceOf(route)] ?? true)) return;
  // No retries: a page whose request failed makes its own. Nothing stays cached once the requests end.
  prefetchRoute(new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }), route, url);
}
