import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Copy01Icon, File02Icon, Folder01Icon, Search01Icon, TextWrapIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { Button, cx } from './bits';
import { ThreadComments, ThreadReply } from './Conversation';
import { FILES, PATCHES, THREAD, type ChangedFile, type PatchPath } from './pr';

export type DiffMode = 'unified' | 'split';
/** `virtual:product-diffs`, once its chunk has loaded. */
export type RenderedDiffs = typeof import('virtual:product-diffs');

/** The Files changed tab (src/pages/pr/files/FilesTab.tsx): file tree on the left, diffs on the right. */
export function FilesChanged({ mode, rendered }: { mode: DiffMode; rendered?: RenderedDiffs }) {
  const viewedCount = FILES.filter((f) => f.viewed).length;
  return (
    <div className="grid gap-6 @3xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden @3xl:flex @3xl:self-start">
        <FileTree />
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="font-medium">{FILES.length} files</span>
          <span className="flex items-center gap-2 text-muted">
            <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-elevated">
              <span className="bg-accent" style={{ width: `${(viewedCount / FILES.length) * 100}%` }} />
            </span>
            {viewedCount} / {FILES.length} viewed
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted">Collapse all</span>
            <span className="text-muted">Expand all</span>
            <span className="flex h-7 items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-2 text-[12px] text-fg">
              <HugeiconsIcon icon={TextWrapIcon} className="size-3.5" />
              Wrap
            </span>
            <div className="flex rounded-lg border border-line bg-panel p-0.5">
              {(['unified', 'split'] as const).map((m) => (
                <span
                  key={m}
                  className={cx(
                    'flex h-6 items-center rounded-md px-2.5 text-[12px] capitalize transition-colors duration-200',
                    mode === m ? 'bg-elevated font-medium text-fg shadow-sm' : 'text-muted',
                  )}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        {FILES.slice(0, 4).map((file) => (
          <FileCard key={file.path} file={file}>
            {file.path in PATCHES && <Diff path={file.path as PatchPath} mode={mode} rendered={rendered} />}
          </FileCard>
        ))}
      </div>
    </div>
  );
}

/** A file card: header with view state over its diff. Viewed files are collapsed. */
function FileCard({ file, children }: { file: ChangedFile; children: ReactNode }) {
  const open = !file.viewed;
  const slash = file.path.lastIndexOf('/');
  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className={cx('flex h-11 items-center gap-2 bg-panel/95 px-3', open ? 'rounded-t-xl border-b border-line' : 'rounded-xl')}>
        <span className="flex size-6 items-center justify-center rounded-md text-subtle">
          <HugeiconsIcon icon={ArrowRight01Icon} className={cx('size-3.5', open && 'rotate-90')} />
        </span>
        <span className="min-w-0 truncate text-left font-mono text-[12.5px]">
          <span className="text-muted">{file.path.slice(0, slash + 1)}</span>
          <span className="font-medium text-fg">{file.path.slice(slash + 1)}</span>
        </span>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-subtle">
          <HugeiconsIcon icon={Copy01Icon} className="size-3" />
        </span>
        {file.status === 'added' && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">Added</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11.5px] tabular-nums">
          <span className="text-success">+{file.additions}</span>
          <span className="text-danger">−{file.deletions}</span>
          <DiffStat file={file} />
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle">
          <HugeiconsIcon icon={File02Icon} className="size-3.5" />
        </span>
        <span
          className={cx(
            'flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[12px]',
            file.viewed ? 'border-accent/40 bg-accent/12 text-fg' : 'border-line text-muted',
          )}
        >
          <span className={cx('flex size-3.5 items-center justify-center rounded-[4px] border', file.viewed ? 'border-accent bg-accent text-white' : 'border-line-strong')}>
            {file.viewed && <HugeiconsIcon icon={Tick02Icon} className="size-2.5" strokeWidth={3.5} />}
          </span>
          Viewed
        </span>
      </header>
      {open && children}
    </section>
  );
}

/** GitHub's five-square diffstat. */
function DiffStat({ file }: { file: ChangedFile }) {
  const total = file.additions + file.deletions || 1;
  const green = Math.round((file.additions / total) * 5);
  const red = Math.min(5 - green, Math.round((file.deletions / total) * 5));
  return (
    <span className="flex gap-px">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={cx('size-2 rounded-[2px]', i < green ? 'bg-success' : i < green + red ? 'bg-danger' : 'bg-elevated')} />
      ))}
    </span>
  );
}

/**
 * A diff as the extension's renderer drew it at build time, in its own shadow root like in the extension. The
 * review thread is slotted under its line.
 */
function Diff({ path, mode, rendered }: { path: PatchPath; mode: DiffMode; rendered?: RenderedDiffs }) {
  const host = useRef<HTMLDivElement>(null);
  const html = rendered && rendered.shared + rendered.diffs[`${path}:${mode}`];
  useLayoutEffect(() => {
    const el = host.current;
    if (el && html) (el.shadowRoot ?? el.attachShadow({ mode: 'open' })).innerHTML = html;
  }, [html]);

  if (!html) return <div className="m-3 h-24 animate-shimmer rounded-lg bg-elevated" />;
  return (
    <div ref={host} className="block overflow-hidden rounded-b-xl">
      {path === THREAD.path && (
        <div slot={`annotation-additions-${THREAD.line}`} className="flex flex-col gap-2 border-y border-line bg-bg px-3 py-3 font-sans text-[13px] leading-normal whitespace-normal">
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex h-10 items-center gap-2 border-b border-line px-3">
              <span className="flex min-w-0 items-center gap-2">
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 shrink-0 rotate-90 text-subtle" />
                <span className="text-[12px] text-muted">Thread</span>
              </span>
              <span className="ml-auto text-[12px] text-subtle">2 comments</span>
              <Button size="sm">Resolve</Button>
            </div>
            <ThreadComments />
            <ThreadReply />
          </div>
        </div>
      )}
    </div>
  );
}

type Node = { name: string; path: string; children: Node[]; file?: ChangedFile };

/** Nests paths into folders, collapsing single-child folder chains ("pages/pr"), as the extension's tree does. */
function buildTree(files: ChangedFile[]): Node[] {
  const root: Node = { name: '', path: '', children: [] };
  for (const file of files) {
    let node = root;
    const parts = file.path.split('/');
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      if (i === parts.length - 1) {
        node.children.push({ name: part, path, children: [], file });
        return;
      }
      let child = node.children.find((c) => c.name === part && !c.file);
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

const TREE = buildTree(FILES);

/** Filterable tree with viewed marks (src/pages/pr/files/FileTree.tsx). */
function FileTree() {
  const render = (nodes: Node[], depth: number): ReactNode =>
    nodes.map((node) =>
      node.file ? (
        <div key={node.path} style={{ paddingLeft: 8 + depth * 12 }} className="flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-[12.5px] text-fg/80">
          <span className={cx('size-1.5 shrink-0 rounded-full', node.file.status === 'added' ? 'bg-success' : 'bg-warning')} />
          <span className={cx('min-w-0 flex-1 truncate', node.file.viewed && 'text-subtle')}>{node.name}</span>
          {node.file.viewed ? (
            <HugeiconsIcon icon={Tick02Icon} className="size-3 shrink-0 text-accent" strokeWidth={3} />
          ) : (
            <span className="shrink-0 font-mono text-[10.5px] text-subtle tabular-nums">{node.file.additions + node.file.deletions}</span>
          )}
        </div>
      ) : (
        <div key={node.path}>
          <div style={{ paddingLeft: 4 + depth * 12 }} className="flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[12.5px] text-muted">
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 shrink-0 rotate-90" />
            <HugeiconsIcon icon={Folder01Icon} className="size-3.5 shrink-0 text-subtle" />
            <span className="truncate">{node.name}</span>
          </div>
          {render(node.children, depth + 1)}
        </div>
      ),
    );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <div className="mb-2 flex h-8 shrink-0 items-center gap-2 rounded-lg border border-line bg-panel px-2.5">
        <HugeiconsIcon icon={Search01Icon} className="size-3.5 text-subtle" />
        <span className="text-[12.5px] text-subtle">Filter files…</span>
      </div>
      <div className="min-h-0">{render(TREE, 0)}</div>
    </div>
  );
}
