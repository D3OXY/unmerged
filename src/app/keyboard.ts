import { useEffect } from 'react';
import { navigate } from '@/lib/navigation';
import { sessionLogin } from '@/lib/session';
import { createStore } from '@/lib/store';
import { paletteOpen } from './commands';

/** The `?` overlay listing the shortcuts below and the current page's keys. */
export const shortcutsOpen = createStore(false);

const isTyping = (target: EventTarget | undefined) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Global shortcuts while Unmerged owns the page. Runs in the window capture phase so it sees keys
 * before GitHub does, and swallows keys aimed at GitHub's hidden page so its hotkeys don't fire.
 *
 * ⌘K palette · j/k move between rows · g h home · g p profile · ? shortcuts · plus keys pages add with
 * `usePageHotkey`. While a dialog is open, j/k stay inside it and page keys are off.
 */
export function installKeyboard(host: HTMLElement, isOwning: () => boolean) {
  let pendingG = 0;

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isOwning()) return;
    const target = event.composedPath()[0];
    const insideUs = event.composedPath().includes(host);

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopImmediatePropagation();
      paletteOpen.set(true);
      return;
    }

    if (!insideUs) event.stopImmediatePropagation();
    if (isTyping(target) || event.metaKey || event.ctrlKey || event.altKey) return;

    const root = host.shadowRoot!;
    const dialog = root.querySelector<HTMLElement>('[aria-modal="true"]');
    if (event.key === 'j' || event.key === 'k') {
      event.preventDefault();
      moveRowFocus(root, dialog ?? root, event.key === 'j' ? 1 : -1);
    } else if (event.key === '?') {
      shortcutsOpen.set(!shortcutsOpen.get());
    } else if (event.key === 'g') {
      pendingG = Date.now();
    } else if (Date.now() - pendingG < 800) {
      pendingG = 0;
      const login = sessionLogin();
      if (event.key === 'h') navigate('/');
      if (event.key === 'p' && login) navigate(`/${login}`);
    } else if (!dialog && pageKeys.has(event.key)) {
      event.preventDefault();
      pageKeys.get(event.key)!.handler();
    }
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}

type PageKey = { handler: () => void; label?: string };
const pageKeys = new Map<string, PageKey>();

/**
 * Binds a single key (e.g. "t") while the calling page is mounted. Ignored while typing. `label` is what
 * the `?` overlay shows for it.
 */
export function usePageHotkey(key: string, handler: () => void, label?: string) {
  useEffect(() => {
    const entry = { handler, label };
    pageKeys.set(key, entry);
    return () => {
      if (pageKeys.get(key) === entry) pageKeys.delete(key);
    };
  }, [key, handler, label]);
}

/** The keys the current page has bound, for the `?` overlay. */
export const pageHotkeys = () => [...pageKeys].map(([key, { label }]) => ({ key, label }));

/** Moves focus through elements marked `data-row` within `scope`, Linear-style. */
function moveRowFocus(root: ShadowRoot, scope: ParentNode, delta: number) {
  const rows = [...scope.querySelectorAll<HTMLElement>('[data-row]')];
  if (!rows.length) return;
  const index = rows.indexOf(root.activeElement as HTMLElement);
  const next = rows[Math.max(0, Math.min(rows.length - 1, index === -1 ? 0 : index + delta))];
  next?.focus();
  next?.scrollIntoView({ block: 'nearest' });
}
