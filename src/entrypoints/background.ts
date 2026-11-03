import { earlyClient, prefetchRoute } from '@/app/prefetch';
import { answerCodeSearch } from '@/github/client';
import { answerEarly, keepEarlyAnswers, prefetchRequest } from '@/github/early';
import { bootTarget, githubPageRequest } from '@/lib/boot';
import { BOOT_RULE_IDS, bootRules, tabAllowRule } from '@/lib/bootRules';
import { matchRoute } from '@/lib/routes';
import { surfaceOf, surfacesItem, type Surfaces } from '@/lib/settings';

// Firefox stays on GitHub's page first: the boot page (lib/boot.ts) is checked in Chrome only.
const BOOT = !import.meta.env.FIREFOX;

// The URL that each tab loads as GitHub's page (`letTabLoad`), which gets no early requests. A restart of the
// background loses it; that only starts requests that no page takes.
const githubPages = new Map<number, string>();

// Content scripts can't reload the extension or open its pages; github.com asks here (see SettingsDialog
// and openSettingsPage in lib/settings.ts). Code search, which github.com can't read, is fetched here too,
// and so are an owned page's first requests (see github/early.ts), also for a link the user points at before
// the page's app has loaded. A tab that must load GitHub's page past the boot redirect asks here too.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === 'reload') browser.runtime.reload();
    const tabId = sender.tab?.id;
    // Beside the GitHub tab, which the browser shows again when the settings page closes itself.
    if (message === 'open-settings') browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#token`, openerTabId: tabId });
    const github = githubPageRequest(message);
    if (github !== undefined && tabId !== undefined) {
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
      if (tabId >= 0 && !bootTarget(target) && githubPages.get(tabId) !== url) prefetchEarly(target);
    },
    { urls: ['https://github.com/*'], types: ['main_frame'] },
  );

  if (BOOT) {
    surfacesItem.getValue().then(updateBootRules);
    surfacesItem.watch(updateBootRules);
  }
  browser.tabs.onRemoved.addListener((tabId) => letTabLoad(tabId, null));

  // Query results stored before the per-account index (lib/persist.ts) were keyed `q:<token suffix>:…` and
  // nothing trims them any more. Dropped on the update that brings the index; later updates find none.
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== 'update') return;
    const legacy = Object.keys(await browser.storage.local.get(null)).filter((key) => key.startsWith('q:'));
    if (legacy.length) await browser.storage.local.remove(legacy);
  });
});

/**
 * Starts the requests of the page at `url` if Unmerged owns it. The background can't see when the content script
 * will leave a page to GitHub (Classic, the homepage while signed out of github.com), and then starts requests
 * that no page takes. The reload that follows (`reloadOnGitHub`) starts none.
 */
async function prefetchEarly(url: URL) {
  const route = matchRoute(url);
  if (!route || !((await surfacesItem.getValue())[surfaceOf(route)] ?? true)) return;
  prefetchRoute(earlyClient(), route, url);
}

/** Replaces the boot redirects with those for `surfaces`. Also on every start: an update may change the table. */
async function updateBootRules(surfaces: Surfaces) {
  const old = await browser.declarativeNetRequest.getDynamicRules();
  // Every id the table may use too: two updates at once both read the old rules before either has written.
  const removeRuleIds = [...new Set([...old.map(({ id }) => id), ...BOOT_RULE_IDS])];
  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: bootRules(surfaces) });
}

/** Lets a tab load `url` as GitHub's page past the boot redirects, in place of the URL it was let load before; null: none. */
async function letTabLoad(tabId: number, url: string | null) {
  if (url) githubPages.set(tabId, url);
  else githubPages.delete(tabId);
  if (BOOT) await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId], addRules: url ? [tabAllowRule(tabId, url)] : [] });
}
