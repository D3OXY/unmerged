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
