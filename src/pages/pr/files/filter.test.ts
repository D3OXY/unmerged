import { describe, expect, it } from 'vitest';
import type { PrFile } from './FileDiff';
import { fileType, fileTypes, isShown, parseHidden } from './filter';

const file = (filename: string, status: PrFile['status'] = 'modified') => ({ filename, status }) as PrFile;

describe('fileType', () => {
  it.each([
    ['src/app.TS', '.ts'],
    ['src/.eslintrc.json', 'dotfile'],
    ['.gitignore', 'dotfile'],
    ['Makefile', 'none'],
    ['dir.d/notes.', 'none'],
    ['pnpm-lock.yaml', '.yaml'],
  ])('%s is %s', (path, type) => {
    expect(fileType(path)).toBe(type);
  });
});

describe('parseHidden', () => {
  it('keeps known entries and extensions, once each', () => {
    expect(parseHidden(['viewed', '.ts', 'deleted', '.ts', 'none', 'dotfile'])).toEqual(['viewed', '.ts', 'deleted', 'none', 'dotfile']);
  });

  it('drops anything else', () => {
    expect(parseHidden(['', 'ts', '.', '.a/b', '.d.ts', 'everything'])).toEqual([]);
  });
});

describe('isShown', () => {
  const hidden = new Set(['viewed', 'deleted', '.lock'] as const);

  it('hides hidden types, viewed files and deleted files', () => {
    expect(isShown(file('yarn.lock'), hidden, undefined)).toBe(false);
    expect(isShown(file('a.ts'), hidden, 'VIEWED')).toBe(false);
    expect(isShown(file('a.ts', 'removed'), hidden, undefined)).toBe(false);
  });

  it('shows the rest, also files changed since viewed', () => {
    expect(isShown(file('a.ts'), hidden, 'UNVIEWED')).toBe(true);
    expect(isShown(file('a.ts'), hidden, 'DISMISSED')).toBe(true);
    expect(isShown(file('a.ts', 'removed'), new Set(), undefined)).toBe(true);
  });
});

describe('fileTypes', () => {
  it('counts each type, most files first, then by name', () => {
    expect(fileTypes(['a.ts', 'b.ts', 'c.md', 'Makefile', 'd.css'].map((f) => file(f)))).toEqual([
      ['.ts', 2],
      ['.css', 1],
      ['.md', 1],
      ['none', 1],
    ]);
  });
});
