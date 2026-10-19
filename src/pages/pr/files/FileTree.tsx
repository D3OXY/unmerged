import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Folder01Icon, Search01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import type { ViewedState } from '../query';
import type { PrFile } from './FileDiff';
import { statusDot } from './status';

type Node = { name: string; path: string; children: Node[]; file?: PrFile };
type Row = { node: Node; depth: number };

const ROW = 28; // px, a row's height (h-7)
const OVERSCAN = 10; // rows mounted past each edge of the visible ones

/** Nests paths into folders, collapsing single-child folder chains ("src/lib/utils"). */
export function buildTree(files: PrFile[]): Node[] {
  const root: Node = { name: '', path: '', children: [] };
  for (const file of files) {
    let node = root;
    const parts = file.filename.split('/');
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      let child = node.children.find((c) => c.name === part && !c.file);
      if (i === parts.length - 1) {
        node.children.push({ name: part, path, children: [], file });
        return;
      }
      if (!child) {
        child = { name: part, path, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const compress = (node: Node): Node => {
    let current = node;
    while (!current.file && current.children.length === 1 && !current.children[0]!.file) {
      const only = current.children[0]!;
      current = { ...only, name: `${current.name}/${only.name}` };
    }
    return { ...current, children: current.children.map(compress).sort((a, b) => Number(!!a.file) - Number(!!b.file)) };
  };
  return root.children.map(compress).sort((a, b) => Number(!!a.file) - Number(!!b.file));
}

/** The tree's rows from top to bottom, without the contents of closed folders. */
export function treeRows(nodes: Node[], closed: Set<string>, depth = 0, rows: Row[] = []) {
  for (const node of nodes) {
    rows.push({ node, depth });
    if (!node.file && !closed.has(node.path)) treeRows(node.children, closed, depth + 1, rows);
  }
  return rows;
}

/** The rows to mount, [start, end), for a scroll position: the visible ones and OVERSCAN more on each side. */
export function rowWindow(scrollTop: number, height: number, count: number): [number, number] {
  return [Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN), Math.min(count, Math.ceil((scrollTop + height) / ROW) + OVERSCAN)];
}

/**
 * Sidebar navigator for a PR's files: filterable tree with viewed marks (and files changed since viewed) and
 * the file in view highlighted. Only the rows near the visible ones mount, so thousands of files stay cheap.
 */
export function FileTree({ files, viewState, active, onSelect }: {
  files: PrFile[];
  viewState: (path: string) => ViewedState | undefined;
  active?: string;
  onSelect: (path: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const rows = useMemo(
    () => treeRows(buildTree(filter ? files.filter((f) => f.filename.toLowerCase().includes(filter.toLowerCase())) : files), closed),
    [files, filter, closed],
  );
  // The list is never taller than the window, so the window's height covers what can show.
  const [start, end] = rowWindow(scrollTop, innerHeight, rows.length);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <label className="mb-2 flex h-8 shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 focus-within:border-accent/50">
        <HugeiconsIcon icon={Search01Icon} className="size-3.5 text-subtle" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files…"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-subtle"
        />
      </label>
      <div className="min-h-0 overflow-x-hidden overflow-y-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        <div style={{ height: rows.length * ROW, paddingTop: start * ROW }}>
          {rows.slice(start, end).map(({ node, depth }) =>
            node.file ? (
              <button
                key={node.path}
                type="button"
                data-row
                onClick={() => onSelect(node.path)}
                title={node.path}
                style={{ paddingLeft: 8 + depth * 12 }}
                className={cx(
                  'flex h-7 w-full cursor-pointer items-center gap-2 rounded-md pr-2 text-left text-[12.5px] focus:outline-none',
                  node.path === active ? 'bg-hover text-fg' : 'text-fg/80 hover:bg-hover focus:bg-hover',
                )}
              >
                <span className={cx('size-1.5 shrink-0 rounded-full', statusDot(node.file.status))} />
                <span className={cx('min-w-0 flex-1 truncate', viewState(node.path) === 'VIEWED' && 'text-subtle')}>{node.name}</span>
                {viewState(node.path) === 'VIEWED' ? (
                  <HugeiconsIcon icon={Tick02Icon} className="size-3 shrink-0 text-accent" strokeWidth={3} />
                ) : (
                  <span
                    title={viewState(node.path) === 'DISMISSED' ? 'Changed since viewed' : undefined}
                    className={cx('shrink-0 font-mono text-[10.5px] tabular-nums', viewState(node.path) === 'DISMISSED' ? 'text-warning' : 'text-subtle')}
                  >
                    {node.file.additions + node.file.deletions}
                  </span>
                )}
              </button>
            ) : (
              <button
                key={node.path}
                type="button"
                onClick={() => setClosed((s) => (s.has(node.path) ? new Set([...s].filter((p) => p !== node.path)) : new Set(s).add(node.path)))}
                aria-expanded={!closed.has(node.path)}
                style={{ paddingLeft: 4 + depth * 12 }}
                className="flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-left text-[12.5px] text-muted hover:bg-hover hover:text-fg"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className={cx('size-3 shrink-0 transition-transform', !closed.has(node.path) && 'rotate-90')} />
                <HugeiconsIcon icon={Folder01Icon} className="size-3.5 shrink-0 text-subtle" />
                <span className="truncate">{node.name}</span>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
