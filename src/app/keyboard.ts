import { useEffect } from 'react';
import { navigate } from '@/lib/navigation';
import { sessionLogin } from '@/lib/session';
import { paletteOpen } from './commands';

const isTyping = (target: EventTarget | undefined) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Global shortcuts while Unmerged owns the page. Runs in the window capture phase so it sees keys
 * before GitHub does, and swallows keys aimed at GitHub's hidden page so its hotkeys don't fire.
 *
 * ⌘K palette · j/k move between rows · g h home · g p profile · plus keys pages add with `usePageHotkey`
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

    if (event.key === 'j' || event.key === 'k') {
      event.preventDefault();
      moveRowFocus(host.shadowRoot!, event.key === 'j' ? 1 : -1);
    } else if (event.key === 'g') {
      pendingG = Date.now();
    } else if (Date.now() - pendingG < 800) {
      pendingG = 0;
      const login = sessionLogin();
      if (event.key === 'h') navigate('/');
      if (event.key === 'p' && login) navigate(`/${login}`);
    } else if (pageKeys.has(event.key)) {
      event.preventDefault();
      pageKeys.get(event.key)!();
    }
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}

const pageKeys = new Map<string, () => void>();

/** Binds a single key (e.g. "t") while the calling page is mounted. Ignored while typing. */
export function usePageHotkey(key: string, handler: () => void) {
  useEffect(() => {
    pageKeys.set(key, handler);
    return () => {
      if (pageKeys.get(key) === handler) pageKeys.delete(key);
    };
  }, [key, handler]);
}

/** Moves focus through elements marked `data-row`, Linear-style. */
function moveRowFocus(root: ShadowRoot, delta: number) {
  const rows = [...root.querySelectorAll<HTMLElement>('[data-row]')];
  if (!rows.length) return;
  const index = rows.indexOf(root.activeElement as HTMLElement);
  const next = rows[Math.max(0, Math.min(rows.length - 1, index === -1 ? 0 : index + delta))];
  next?.focus();
  next?.scrollIntoView({ block: 'nearest' });
}
