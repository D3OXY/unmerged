import { useSyncExternalStore } from 'react';
import { CHROME_STORE_URL } from './site';

const INSTALL_PAGE = '/install';

/** Desktop Chromium browsers (Chrome, Arc, Brave, Edge) install from the Chrome Web Store; phones can't. */
const canUseChromeStore = () => /Chrome\//.test(navigator.userAgent) && !/Android|Mobile/.test(navigator.userAgent);

const subscribe = () => () => {};

/**
 * Where an Install button goes: straight to the Chrome Web Store in a browser that can install from it,
 * otherwise the /install page. Prerendered pages (and readers without JavaScript) get /install.
 */
export function useInstallHref() {
  return useSyncExternalStore(subscribe, () => (canUseChromeStore() ? CHROME_STORE_URL : INSTALL_PAGE), () => INSTALL_PAGE);
}
