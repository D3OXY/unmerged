import { describe, expect, it } from 'vitest';
import type { PrFile } from './FileDiff';
import { buildTree, rowWindow, treeRows } from './FileTree';

const tree = buildTree(['src/lib/a.ts', 'src/lib/b.ts', 'src/c.ts', 'README.md'].map((filename) => ({ filename }) as PrFile));
const rows = (closed: string[] = []) => treeRows(tree, new Set(closed)).map(({ node, depth }) => `${depth} ${node.name}`);

describe('treeRows', () => {
  it('lists folders before their contents, one level deeper', () => {
    expect(rows()).toEqual(['0 src', '1 lib', '2 a.ts', '2 b.ts', '1 c.ts', '0 README.md']);
  });

  it('skips the contents of closed folders', () => {
    expect(rows(['src/lib'])).toEqual(['0 src', '1 lib', '1 c.ts', '0 README.md']);
    expect(rows(['src'])).toEqual(['0 src', '0 README.md']);
  });
});

describe('rowWindow', () => {
  // Rows are 28 px; 10 more mount past each edge.
  it.each([
    ['at the top', 0, [0, 20]],
    ['scrolled', 28 * 100, [90, 120]],
    ['part of a row scrolled away', 28 * 100 + 14, [90, 121]],
    ['at the end', 28 * 990, [980, 1000]],
  ])('%s', (_, scrollTop, expected) => {
    expect(rowWindow(scrollTop, 280, 1000)).toEqual(expected);
  });

  it('never passes the last row', () => {
    expect(rowWindow(0, 900, 5)).toEqual([0, 5]);
  });
});
