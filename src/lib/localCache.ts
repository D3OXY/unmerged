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

/**
 * A query's last result kept in localStorage with when it was fetched, read synchronously for `initialData`
 * (the shell paints with it) and `initialDataUpdatedAt` (so `staleTime` holds across page loads instead of
 * refetching on every one).
 */
export function cachedQuery<T>(key: string) {
  const cache = localCache<{ at: number; data: T }>(key);
  return {
    initialData: () => cache.get()?.data,
    initialDataUpdatedAt: () => cache.get()?.at,
    save(data: T) {
      cache.set({ at: Date.now(), data });
      return data;
    },
  };
}
