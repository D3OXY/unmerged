import { useSyncExternalStore } from 'react';
import { CHROME_STORE_URL, FIREFOX_STORE_URL } from './site';

/** Where this browser installs from. Phones can't run the extension; `other` covers unknown browsers and prerendering. */
export type Browser = 'chrome' | 'firefox' | 'phone' | 'other';

/** Desktop Chromium browsers (Chrome, Arc, Brave, Edge) install from the Chrome Web Store, desktop Firefox from Firefox Add-ons. */
function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/Android|Mobile/.test(ua)) return 'phone';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  return 'other';
}

const subscribe = () => () => {};

/** The reader's browser. Prerendered pages (and readers without JavaScript) get `other`. */
export function useBrowser() {
  return useSyncExternalStore(subscribe, detectBrowser, (): Browser => 'other');
}

const INSTALL_HREF: Record<Browser, string> = {
  chrome: CHROME_STORE_URL,
  firefox: FIREFOX_STORE_URL,
  phone: '/install',
  other: '/install',
};

/** Where an Install link goes: straight to this browser's store, otherwise the /install page. */
export function useInstallHref() {
  return INSTALL_HREF[useBrowser()];
}
