import { describe, expect, it } from 'vitest';
import { codeOf } from './diffs';
import { matchRoute } from './routes';

describe('codeOf', () => {
  it.each<[string, ReturnType<typeof codeOf>]>([
    ['https://github.com/o/r/pull/12/files', 'diffs'],
    ['https://github.com/o/r/pull/12', undefined],
    ['https://github.com/o/r/commit/0123456789abcdef0123456789abcdef01234567', 'diffs'],
    ['https://github.com/o/r/compare/main...feature', 'diffs'],
    ['https://github.com/o/r/compare', undefined],
    ['https://github.com/o/r/blob/main/src/index.ts', 'file'],
    ['https://github.com/o/r', undefined],
    ['https://github.com/o/r/issues', undefined],
  ])('%s → %s', (url, expected) => {
    const route = matchRoute(new URL(url));
    expect(route).not.toBeNull();
    expect(codeOf(route!)).toBe(expected);
  });
});
