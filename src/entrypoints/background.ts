// Content scripts can't reload the extension; the in-page Settings dialog asks here (see SettingsDialog).
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message) => {
    if (message === 'reload') browser.runtime.reload();
  });
});
