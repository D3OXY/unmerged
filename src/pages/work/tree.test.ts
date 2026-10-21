import { describe, expect, it } from 'vitest';
import type { IssueParent, WorkItem } from './queries';
import { FAMILY_SHOWN, issueTree, type TreeRow } from './tree';

const stub = (id: string): IssueParent => ({ id, number: 1, title: id, url: '', state: 'OPEN', stateReason: null, repository: { nameWithOwner: 'o/r' } });
const issue = (id: string, parent?: string) => ({ __typename: 'Issue', id, parent: parent ? stub(parent) : null }) as WorkItem;

/** Each line as `depth:id`, a parent that isn't in the list as `depth:(id)`, and the rest of a family as `depth:+count`. */
const lines = (rows: TreeRow[]) =>
  rows.map((row) => `${row.depth}:${row.kind === 'item' ? row.item.id : row.kind === 'parent' ? `(${row.parent.id})` : `+${row.count}`}`);

describe('issueTree', () => {
  it('puts each family where its first issue is, in GitHub’s order, and shows each issue once', () => {
    // Search order: newest first. GitHub's order of P's sub-issues: oldest first.
    const items = [issue('a'), issue('c', 'P'), issue('b', 'P'), issue('P'), issue('d')];
    const families = new Map([['P', [issue('b', 'P'), issue('c', 'P'), issue('e', 'P')]]]);
    expect(lines(issueTree(items, families, new Set()))).toEqual(['0:a', '0:P', '1:b', '1:c', '1:e', '0:d']);
  });

  it('holds a family under its parent when the parent is not in the list', () => {
    const items = [issue('a', 'P'), issue('b')];
    const families = new Map([['P', [issue('a', 'P')]]]);
    expect(lines(issueTree(items, families, new Set()))).toEqual(['0:(P)', '1:a', '0:b']);
  });

  it('nests a family inside the family of its parent', () => {
    const items = [issue('c', 'B'), issue('A')];
    const families = new Map([
      ['A', [issue('B', 'A')]],
      ['B', [issue('c', 'B')]],
    ]);
    expect(lines(issueTree(items, families, new Set()))).toEqual(['0:A', '1:B', '2:c']);
  });

  it('leaves an issue in place while its family is missing', () => {
    expect(lines(issueTree([issue('a', 'P'), issue('b')], new Map(), new Set()))).toEqual(['0:a', '0:b']);
  });

  it('ends a long family in a more line until it is expanded', () => {
    const children = Array.from({ length: FAMILY_SHOWN + 2 }, (_, i) => issue(`s${i}`, 'P'));
    const families = new Map([['P', children]]);
    expect(lines(issueTree([issue('P')], families, new Set())).slice(-2)).toEqual([`1:s${FAMILY_SHOWN - 1}`, '1:+2']);
    expect(issueTree([issue('P')], families, new Set(['P']))).toHaveLength(children.length + 1);
  });
});
