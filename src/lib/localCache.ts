/**
 * A JSON value in github.com's localStorage, read synchronously: a mirror of a setting, to paint with before
 * extension storage answers. Never API data: the page's scripts and other extensions can read it.
 */
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
