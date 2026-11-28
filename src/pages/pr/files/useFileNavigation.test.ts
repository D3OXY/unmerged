import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CommitFiles } from '@/pages/commit/CommitFiles';
import type { PrFile } from './FileDiff';

const files: PrFile[] = ['first.ts', 'second.ts'].map((filename) => ({
  filename, sha: 'abc', status: 'added', additions: 640, deletions: 0, changes: 640, blob_url: '',
}));

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] }));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mount(inPanel: boolean) {
  const host = document.body.appendChild(document.createElement('div'));
  if (inPanel) host.style.overflowY = 'auto';
  const root = createRoot(host);
  flushSync(() => root.render(createElement(CommitFiles, { files, error: null, source: { nameWithOwner: 'owner/repo', oid: 'abc' } })));
  const cards = host.querySelectorAll('section');
  const rows = host.querySelectorAll<HTMLButtonElement>('button[data-row]');
  return {
    host, cards, rows,
    unmount() {
      root.unmount();
      host.remove();
    },
  };
}

const frame = () => flushSync(() => vi.advanceTimersToNextFrame());

it('highlights the file under the Side panel header when the panel alone scrolls', () => {
  const { host, cards, rows, unmount } = mount(true);
  try {
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 200, 600, 400));
    vi.spyOn(cards[0]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 260, 600, 400));
    const second = vi.spyOn(cards[1]!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 660, 600, 400));
    frame();
    expect(rows[0]!.getAttribute('aria-current')).toBe('location');

    second.mockReturnValue(new DOMRect(0, 330, 600, 400));
    host.dispatchEvent(new Event('scroll'));
    frame();
    expect(rows[0]!.hasAttribute('aria-current')).toBe(false);
    expect(rows[1]!.getAttribute('aria-current')).toBe('location');
  } finally {
    unmount();
  }
});

it.each([true, false])('expands a selected file and keeps its header in view (Side panel: %s)', (inPanel) => {
  const { host, cards, rows, unmount } = mount(inPanel);
  try {
    const panelScroll = vi.spyOn(host, 'scrollBy').mockImplementation(() => {});
    const windowScroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    const scroll = inPanel ? panelScroll : windowScroll;
    const top = inPanel ? 200 : 0;
    const card = cards[1]!;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, top, 600, 400));
    const position = vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, top + 300, 600, 46));
    card.style.scrollMarginTop = '104px';
    const height = card.style.height;
    flushSync(() => rows[1]!.click());
    expect(parseFloat(card.style.height)).toBeGreaterThan(parseFloat(height));
    frame();
    expect(scroll).toHaveBeenLastCalledWith({ top: 196, behavior: 'instant' });

    // An earlier diff grows after the jump. Only the same scroll container should move.
    position.mockReturnValue(new DOMRect(0, top + 160, 600, 112));
    frame();
    expect(scroll).toHaveBeenLastCalledWith({ top: 56, behavior: 'instant' });
    expect(inPanel ? windowScroll : panelScroll).not.toHaveBeenCalled();
    host.dispatchEvent(new Event('wheel', { bubbles: true }));
    scroll.mockClear();
    frame();
    expect(scroll).not.toHaveBeenCalled();
  } finally {
    unmount();
  }
});
