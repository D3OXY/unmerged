import { QueryClient } from '@tanstack/react-query';
import { prefetchRoute } from '@/app/prefetch';
import { answerCodeSearch } from '@/github/client';
import { answerEarly, keepEarlyAnswers, prefetchRequest } from '@/github/early';
import { bootTarget, githubPageRequest } from '@/lib/boot';
import { BOOT_RULE_IDS, bootRules, tabAllowRule } from '@/lib/bootRules';
import { matchRoute } from '@/lib/routes';
import { surfaceOf, surfacesItem, type Surfaces } from '@/lib/settings';

// Firefox stays on GitHub's page first: the boot page (lib/boot.ts) is checked in Chrome only.
const BOOT = !import.meta.env.FIREFOX;

// Content scripts can't reload the extension or open its pages; github.com asks here (see SettingsDialog
// and openSettingsPage in lib/settings.ts). Code search, which github.com can't read, is fetched here too,
// and so are an owned page's first requests (see github/early.ts), also for a link the user points at before
// the page's app has loaded. A tab that must load GitHub's page past the boot redirect asks here too.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === 'reload') browser.runtime.reload();
    if (message === 'open-settings') browser.runtime.openOptionsPage();
    const github = githubPageRequest(message);
    const tabId = sender.tab?.id;
    if (BOOT && github !== undefined && tabId !== undefined) {
      letTabLoad(tabId, github).then(() => sendResponse(true), () => sendResponse(false));
      return true;
    }
    const prefetch = prefetchRequest(message);
    if (prefetch) prefetchEarly(prefetch);
    const answer = answerCodeSearch(message) ?? answerEarly(message);
    if (!answer) return;
    answer.then(sendResponse);
    return true; // Answers asynchronously.
  });

  // A tab starts to load a github.com page: if it's one we own, its requests start now, while GitHub's server
  // is still answering, and the page takes their answers when it runs.
  keepEarlyAnswers();
  // A load redirected to the boot page reaches here twice: as itself, then as the boot page. Only the first counts.
  browser.webRequest.onBeforeRequest.addListener(
    ({ url, tabId }) => {
      const target = new URL(url);
      if (tabId >= 0 && !bootTarget(target)) prefetchEarly(target);
    },
    { urls: ['https://github.com/*'], types: ['main_frame'] },
  );

  if (BOOT) {
    surfacesItem.getValue().then(updateBootRules);
    surfacesItem.watch(updateBootRules);
    browser.tabs.onRemoved.addListener((tabId) => letTabLoad(tabId, null));
  }

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

/** Replaces the boot redirects with those for `surfaces`. Also on every start: an update may change the table. */
async function updateBootRules(surfaces: Surfaces) {
  const old = await browser.declarativeNetRequest.getDynamicRules();
  // Every id the table may use too: two updates at once both read the old rules before either has written.
  const removeRuleIds = [...new Set([...old.map(({ id }) => id), ...BOOT_RULE_IDS])];
  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: bootRules(surfaces) });
}

/** Lets a tab load `url` as GitHub's page past the boot redirects, in place of the URL it was let load before; null: none. */
function letTabLoad(tabId: number, url: string | null) {
  return browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId], addRules: url ? [tabAllowRule(tabId, url)] : [] });
}
