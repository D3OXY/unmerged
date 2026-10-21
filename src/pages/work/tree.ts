import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { familyIds, issueFamilyQuery, type IssueParent, type ListPage, type WorkItem } from './queries';

/**
 * A line of a nested issue list: an issue, a parent that isn't in the list (to hold its sub-issues), or the
 * hidden rest of a long family.
 */
export type TreeRow =
  | { kind: 'item'; item: WorkItem; depth: number }
  | { kind: 'parent'; parent: IssueParent; depth: number }
  | { kind: 'more'; parentId: string; count: number; depth: number };

/** Sub-issues a family shows before "Show more". */
export const FAMILY_SHOWN = 10;

// GitHub nests sub-issues at most 8 levels deep.
const MAX_DEPTH = 8;

/**
 * `items` (a list's results, in order) with each family nested under its parent. `families` maps a parent's id
 * to its sub-issues, in GitHub's order, already cut to the ones the list shows. A family takes the place of its
 * first issue in `items`; every issue shows once. A family beyond FAMILY_SHOWN ends in a `more` line unless its
 * parent is in `expanded`. A result whose family is missing (not loaded, or not in it) stays where it is.
 */
export function issueTree(items: WorkItem[], families: ReadonlyMap<string, WorkItem[]>, expanded: ReadonlySet<string>) {
  const parentOf = new Map<string, string>();
  const byId = new Map<string, WorkItem>();
  for (const [parentId, children] of families) {
    for (const child of children) {
      parentOf.set(child.id, parentId);
      byId.set(child.id, child);
    }
  }
  const stubs = new Map<string, IssueParent>();
  for (const item of items) {
    byId.set(item.id, item);
    if (item.__typename === 'Issue' && item.parent) stubs.set(item.parent.id, item.parent);
  }

  const top = (id: string) => {
    for (let depth = 0, up = parentOf.get(id); up && depth < MAX_DEPTH; depth++, up = parentOf.get(id)) id = up;
    return id;
  };

  const rows: TreeRow[] = [];
  const shown = new Set<string>();
  const add = (id: string, depth: number) => {
    if (shown.has(id)) return;
    shown.add(id);
    const item = byId.get(id);
    const stub = stubs.get(id);
    if (item) rows.push({ kind: 'item', item, depth });
    else if (stub) rows.push({ kind: 'parent', parent: stub, depth });
    const children = families.get(id) ?? [];
    const visible = expanded.has(id) ? children : children.slice(0, FAMILY_SHOWN);
    for (const child of visible) add(child.id, depth + 1);
    if (visible.length < children.length) rows.push({ kind: 'more', parentId: id, count: children.length - visible.length, depth: depth + 1 });
  };
  for (const item of items) add(top(item.id), 0);
  return rows;
}

/**
 * The nested rows of a list's `pages`, or null when `on` is false (then it asks for nothing). Fetches the
 * families of the results; `state` ('open', 'closed' or '' for any, from the search) picks which sub-issues
 * show. A page joins the tree once all its families are in, so a family never grows under the user's eyes;
 * until then `waiting` is true.
 */
export function useIssueTree(pages: ListPage[] | undefined, state: string, on: boolean) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const pageItems = on ? (pages ?? []).map((page) => page.results.nodes) : [];
  const ids = familyIds(pageItems.flat());
  const results = useQueries({ queries: ids.map((id) => issueFamilyQuery(id)) });
  if (!on) return null;

  const families = new Map<string, WorkItem[]>();
  ids.forEach((id, i) => {
    const data = results[i]?.data;
    if (data) families.set(id, state ? data.filter((child) => child.state.toLowerCase() === state) : data);
  });
  // A family that failed to load counts as in: its issues then show without it.
  const settled = new Set(ids.filter((_, i) => results[i]?.data || results[i]?.isError));
  const ready = pageItems.findIndex((items) => !familyIds(items).every((id) => settled.has(id)));
  const items = (ready === -1 ? pageItems : pageItems.slice(0, ready)).flat();
  return {
    rows: issueTree(items, families, expanded),
    waiting: ready !== -1,
    expand: (id: string) => setExpanded((open) => new Set(open).add(id)),
  };
}

/** What `useIssueTree` gives a list. */
export type IssueTree = NonNullable<ReturnType<typeof useIssueTree>>;
