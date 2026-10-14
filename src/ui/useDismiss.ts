import { useEffect, type RefObject } from 'react';

/**
 * Closes a popover on Escape or a pointerdown outside every element in `refs` (trigger and a portaled
 * panel count as one). Listens on our shadow root, where the events live.
 */
export function useDismiss(refs: RefObject<HTMLElement | null>[], open: boolean, close: () => void) {
  useEffect(() => {
    const first = refs[0]?.current;
    if (!open || !first) return;
    const root = first.getRootNode() as ShadowRoot;
    const onPointer = (e: Event) => {
      const path = e.composedPath();
      if (!refs.some((ref) => ref.current && path.includes(ref.current))) close();
    };
    const onKey = (e: Event) => (e as KeyboardEvent).key === 'Escape' && close();
    root.addEventListener('pointerdown', onPointer);
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('pointerdown', onPointer);
      root.removeEventListener('keydown', onKey);
    };
    // `refs` is a fresh array each render; the refs inside it are stable.
  }, [open, close]);
}
