import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Folder01Icon, Search01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import type { ViewedState } from '../query';
import type { PrFile } from './FileDiff';
import { statusDot } from './status';

type Node = { name: string; path: string; children: Node[]; file?: PrFile };

/** Nests paths into folders, collapsing single-child folder chains ("src/lib/utils"). */
function buildTree(files: PrFile[]): Node[] {
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

/**
 * Sidebar navigator for a PR's files: filterable tree with viewed marks (and files changed since viewed) and
 * the file in view highlighted.
 */
export function FileTree({ files, viewState, active, onSelect }: {
  files: PrFile[];
  viewState: (path: string) => ViewedState | undefined;
  active?: string;
  onSelect: (path: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const tree = useMemo(
    () => buildTree(filter ? files.filter((f) => f.filename.toLowerCase().includes(filter.toLowerCase())) : files),
    [files, filter],
  );

  const render = (nodes: Node[], depth: number) =>
    nodes.map((node) =>
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
        <div key={node.path}>
          <button
            type="button"
            onClick={() => setClosed((s) => (s.has(node.path) ? new Set([...s].filter((p) => p !== node.path)) : new Set(s).add(node.path)))}
            style={{ paddingLeft: 4 + depth * 12 }}
            className="flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-left text-[12.5px] text-muted hover:bg-hover hover:text-fg"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className={cx('size-3 shrink-0 transition-transform', !closed.has(node.path) && 'rotate-90')} />
            <HugeiconsIcon icon={Folder01Icon} className="size-3.5 shrink-0 text-subtle" />
            <span className="truncate">{node.name}</span>
          </button>
          {!closed.has(node.path) && render(node.children, depth + 1)}
        </div>
      ),
    );

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
      <div className="min-h-0 overflow-x-hidden overflow-y-auto">{render(tree, 0)}</div>
    </div>
  );
}
