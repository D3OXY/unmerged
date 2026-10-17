import { answerCodeSearch } from '@/github/client';

// Content scripts can't reload the extension or open its pages; github.com asks here (see SettingsDialog
// and openSettingsPage in lib/settings.ts). Code search, which github.com can't read, is fetched here too.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message === 'reload') browser.runtime.reload();
    if (message === 'open-settings') browser.runtime.openOptionsPage();
    const answer = answerCodeSearch(message);
    if (!answer) return;
    answer.then(sendResponse);
    return true; // Answers asynchronously.
  });

  // Query results stored before the per-account index (lib/persist.ts) were keyed `q:<token suffix>:…` and
  // nothing trims them any more. Dropped on the update that brings the index; later updates find none.
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== 'update') return;
    const legacy = Object.keys(await browser.storage.local.get(null)).filter((key) => key.startsWith('q:'));
    if (legacy.length) await browser.storage.local.remove(legacy);
  });
});
