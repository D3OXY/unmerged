import { afterEach, describe, expect, it, vi } from 'vitest';
import { forceReloaded, markForceReload } from './forceReload';

/** The next document: its navigation type, as the browser reports it. */
function load(type: NavigationTimingType) {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type } as PerformanceNavigationTiming]);
  return forceReloaded();
}

const press = (init: KeyboardEventInit) => markForceReload(new KeyboardEvent('keydown', init));

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('forceReloaded', () => {
  it.each([
    { key: 'R', code: 'KeyR', ctrlKey: true, shiftKey: true },
    { key: 'R', code: 'KeyR', metaKey: true, shiftKey: true },
    { key: 'F5', code: 'F5', ctrlKey: true },
    { key: 'F5', code: 'F5', shiftKey: true },
  ])('is true for the reload after a force reload shortcut: %o', (init) => {
    press(init);
    expect(load('reload')).toBe(true);
  });

  it('is false after a plain reload shortcut', () => {
    press({ key: 'r', code: 'KeyR', ctrlKey: true });
    press({ key: 'F5', code: 'F5' });
    expect(load('reload')).toBe(false);
  });

  it('is false when the shortcut did not reload, and for the documents after it', () => {
    press({ key: 'R', code: 'KeyR', ctrlKey: true, shiftKey: true });
    expect(load('navigate')).toBe(false);
    expect(load('reload')).toBe(false);
  });
});
