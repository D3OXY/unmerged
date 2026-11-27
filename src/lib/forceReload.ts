// A force reload (Ctrl/Cmd+Shift+R, Ctrl/Shift+F5) skips the browser's cache, so it skips Unmerged's stored
// results too. No browser API tells a force reload from a reload: only the request's `Cache-Control: no-cache`
// header differs, and webRequest doesn't see it. So the key press that starts one marks it in sessionStorage,
// and the next document in this tab reads the mark.

const MARK = 'unmerged:force-reload';

/** A `keydown` listener (capture, on window, every github.com page) that marks a force reload's shortcut. */
export function markForceReload(event: KeyboardEvent) {
  const r = event.shiftKey && (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'r' || event.code === 'KeyR');
  const f5 = event.key === 'F5' && (event.ctrlKey || event.shiftKey);
  if (r || f5) sessionStorage.setItem(MARK, '');
}

/**
 * Whether this document is a force reload. Read once at document_start: it clears the mark, so a shortcut that
 * didn't reload counts only if the next document is a reload.
 */
export function forceReloaded() {
  const marked = sessionStorage.getItem(MARK) !== null;
  sessionStorage.removeItem(MARK);
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return marked && entry?.type === 'reload';
}
