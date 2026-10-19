/** A JSON value in the page's localStorage: last-known data to paint before a fetch returns. */
export function localCache<T>(key: string) {
  return {
    get(): T | undefined {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : undefined;
      } catch {
        return undefined;
      }
    },
    set(value: T) {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

// github.com's copy of the extension's account id (`accountItem`), kept current by the app (src/entrypoints/app.tsx) so
// API data cached in the page can be checked synchronously against it.
const ACCOUNT_KEY = 'unmerged:account';
const pageAccount = () => localStorage.getItem(ACCOUNT_KEY) ?? '';
/** Every `cachedQuery` key: API data from the account they were fetched with. */
const API_MIRRORS = new Set<string>();

/**
 * Records the extension's current account in the page. On a change (a new token, or Disconnect) the
 * previous account's cached API data is removed from this page's localStorage.
 */
export function setPageAccount(account: string) {
  if (account === pageAccount()) return;
  for (const key of API_MIRRORS) localStorage.removeItem(key);
  localStorage.setItem(ACCOUNT_KEY, account);
}

/**
 * A query's last result kept in localStorage with when it was fetched and for which account, read
 * synchronously for `initialData` (the shell paints with it) and `initialDataUpdatedAt` (so `staleTime` holds
 * across page loads instead of refetching on every one). Another account's result is never used.
 */
export function cachedQuery<T>(key: string) {
  API_MIRRORS.add(key);
  const cache = localCache<{ account: string; at: number; data: T }>(key);
  const current = () => {
    const entry = cache.get();
    return entry?.account === pageAccount() ? entry : undefined;
  };
  return {
    initialData: () => current()?.data,
    initialDataUpdatedAt: () => current()?.at,
    /** Waits for `fetch` and keeps the result, filed under the account that was current when it started. */
    async save(fetch: Promise<T>) {
      const account = pageAccount();
      const data = await fetch;
      cache.set({ account, at: Date.now(), data });
      return data;
    },
  };
}
