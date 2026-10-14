import { useEffect } from 'react';

/** Sets the tab title. In-place navigations never load GitHub's page, so its title would go stale. */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
