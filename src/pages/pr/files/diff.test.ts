import { describe, expect, it } from 'vitest';
import { oldContents } from './diff';

const lines = (...l: string[]) => l.join('\n');

describe('oldContents', () => {
  it.each([
    {
      name: 'a change in the middle',
      old: lines('a', 'b', 'c', 'd', 'e'),
      new: lines('a', 'b', 'C', 'd', 'e'),
      patch: lines('@@ -2,3 +2,3 @@', ' b', '-c', '+C', ' d'),
    },
    {
      name: 'lines added at the top',
      old: lines('a', 'b'),
      new: lines('x', 'y', 'a', 'b'),
      patch: lines('@@ -1,2 +1,4 @@', '+x', '+y', ' a', ' b'),
    },
    {
      name: 'a deletion with no context (empty new side)',
      old: lines('a', 'x', 'b'),
      new: lines('a', 'b'),
      patch: lines('@@ -2 +1,0 @@', '-x'),
    },
    {
      name: 'a new file',
      old: '',
      new: lines('a', 'b'),
      patch: lines('@@ -0,0 +1,2 @@', '+a', '+b'),
    },
    {
      name: 'two hunks with unchanged lines between and after',
      old: lines('l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10'),
      new: lines('l1', 'L2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'new', 'l9', 'l10'),
      patch: lines('@@ -1,3 +1,3 @@', ' l1', '-l2', '+L2', ' l3', '@@ -7,3 +7,4 @@', ' l7', ' l8', '+new', ' l9'),
    },
  ])('$name', ({ old, new: next, patch }) => {
    expect(oldContents(next, patch)).toBe(old);
  });
});
