import { useSyncExternalStore } from 'react';

/** Whether a media query (e.g. `(min-width: 64rem)`) matches, following resizes. */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
  );
}
