import { useSyncExternalStore } from 'react';
import { CHROME_STORE_URL, FIREFOX_STORE_URL } from './site';

const INSTALL_PAGE = '/install';

/**
 * Where this browser installs from: desktop Chromium browsers (Chrome, Arc, Brave, Edge) from the Chrome
 * Web Store, desktop Firefox from Firefox Add-ons. Phones and other browsers go to the /install page.
 */
function installHref() {
  const ua = navigator.userAgent;
  if (/Android|Mobile/.test(ua)) return INSTALL_PAGE;
  if (/Chrome\//.test(ua)) return CHROME_STORE_URL;
  if (/Firefox\//.test(ua)) return FIREFOX_STORE_URL;
  return INSTALL_PAGE;
}

const subscribe = () => () => {};

/**
 * Where an Install button goes: straight to this browser's store, otherwise the /install page. Prerendered
 * pages (and readers without JavaScript) get /install.
 */
export function useInstallHref() {
  return useSyncExternalStore(subscribe, installHref, () => INSTALL_PAGE);
}
