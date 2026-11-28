import { useCallback, useEffect, useRef, useState } from 'react';

type InnerTarget = (card: HTMLElement) => Element | null;

/** Tracks the file under the sticky headers and lets the tree or a shortcut jump to a file. */
export function useFileNavigation(files: readonly { filename: string }[] | undefined, setOpen: (path: string, open: boolean) => void) {
  const cards = useRef(new Map<string, HTMLElement>());
  const panel = useRef<HTMLElement | null>(null);
  const jumped = useRef<string>(undefined);
  const stopPin = useRef<() => void>(undefined);
  const [active, setActive] = useState<string>();
  const cardRef = useCallback((path: string, el: HTMLElement | null) => {
    if (el) cards.current.set(path, el);
    else cards.current.delete(path);
  }, []);

  const fileInView = useCallback(() => {
    if (!files?.length) return;
    const cutoff = (panel.current?.getBoundingClientRect().top ?? 0) + 150;
    let first = 0;
    let end = files.length;
    // File cards stay in display order, even before a diff mounts.
    while (first < end) {
      const mid = Math.floor((first + end) / 2);
      const card = cards.current.get(files[mid]!.filename);
      if (card && card.getBoundingClientRect().top <= cutoff) first = mid + 1;
      else end = mid;
    }
    return files[first - 1]?.filename;
  }, [files]);

  const listRef = useCallback((list: HTMLElement | null) => {
    if (!list) return;
    panel.current = scrollParent(list);
    const root = panel.current ?? window;
    let frame = 0;
    const update = () => {
      frame = 0;
      setActive(fileInView());
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [fileInView]);

  const pinFile = useCallback((path: string, inner?: InnerTarget) => {
    stopPin.current?.();
    const card = cards.current.get(path);
    if (card) stopPin.current = pinScroll(card, panel.current, inner);
  }, []);
  useEffect(() => () => stopPin.current?.(), []);

  const selectFile = useCallback((path: string, inner?: InnerTarget) => {
    if (!cards.current.has(path)) return;
    jumped.current = path;
    setOpen(path, true);
    pinFile(path, inner);
  }, [setOpen, pinFile]);

  // At the end of the list a selected card can stay below the sticky headers.
  const currentFile = useCallback(() => {
    const path = jumped.current;
    const card = path && cards.current.get(path);
    if (card) {
      const bounds = panel.current?.getBoundingClientRect();
      const top = card.getBoundingClientRect().top;
      if (top >= (bounds?.top ?? 0) && top < (bounds?.bottom ?? innerHeight)) return path;
    }
    return fileInView();
  }, [fileInView]);

  return { listRef, cardRef, active, currentFile, selectFile, pinFile };
}

function scrollParent(el: HTMLElement) {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent;
  }
  return null;
}

/** Keep the target in place while earlier diffs mount or collapse. User input releases it. */
function pinScroll(card: HTMLElement, panel: HTMLElement | null, inner?: InnerTarget) {
  const until = performance.now() + 1500;
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  const margin = parseFloat(getComputedStyle(card).scrollMarginTop) || 0;
  let frame = requestAnimationFrame(tick);
  function stop() {
    cancelAnimationFrame(frame);
    for (const event of events) window.removeEventListener(event, stop, true);
  }
  function tick() {
    if (!card.isConnected || performance.now() > until) return stop();
    const target = inner?.(card);
    const rect = (target ?? card).getBoundingClientRect();
    const bounds = panel?.getBoundingClientRect();
    const offset = target ? ((bounds?.height ?? innerHeight) - rect.height) / 2 : margin;
    const delta = rect.top - (bounds?.top ?? 0) - offset;
    if (Math.abs(delta) >= 1) (panel ?? window).scrollBy({ top: delta, behavior: 'instant' });
    frame = requestAnimationFrame(tick);
  }
  for (const event of events) window.addEventListener(event, stop, { capture: true, passive: true });
  return stop;
}
