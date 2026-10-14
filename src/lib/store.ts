import { useSyncExternalStore } from 'react';

/** Minimal global state cell readable from React (`use`) and from plain code (`get`/`set`). */
export function createStore<T>(initial: T) {
  let value = initial;
  const subscribers = new Set<() => void>();
  const subscribe = (fn: () => void) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  };
  return {
    get: () => value,
    set(next: T) {
      value = next;
      subscribers.forEach((fn) => fn());
    },
    use: () => useSyncExternalStore(subscribe, () => value),
  };
}
