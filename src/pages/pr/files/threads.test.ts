import { describe, expect, it } from 'vitest';
import type { ReviewThread } from '../query';
import type { PrFile } from './FileDiff';
import { nextOpenThread } from './threads';

const files = ['b.ts', 'a.ts'].map((filename) => ({ filename }) as PrFile);
const thread = (id: string, path: string, line: number | null, isResolved = false) => ({ id, path, line, isResolved }) as ReviewThread;

// Page order: b.ts before a.ts (the files' order, not the alphabet), then by line.
const b5 = thread('b5', 'b.ts', 5);
const b20 = thread('b20', 'b.ts', 20);
const a1 = thread('a1', 'a.ts', 1);
const threads = [a1, b20, thread('resolved', 'b.ts', 10, true), thread('outdated', 'b.ts', null), b5];

describe('nextOpenThread', () => {
  it.each([
    ['nothing jumped to yet', undefined, b5],
    ['within a file', b5, b20],
    ['across files', b20, a1],
    ['wrapping around', a1, b5],
    ['after a thread resolved since', thread('gone', 'b.ts', 10, true), b20],
  ])('%s', (_, last, expected) => {
    expect(nextOpenThread(threads, files, last)).toBe(expected);
  });

  it('finds nothing when every thread is resolved or off the diff', () => {
    expect(nextOpenThread([thread('r', 'a.ts', 1, true), thread('o', 'a.ts', null)], files)).toBeUndefined();
  });
});
