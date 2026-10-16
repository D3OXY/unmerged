import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { Check, ChevronRight, Copy, FileText } from 'lucide-react';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import type { PullRequest, ReviewThread } from '../query';
import { DiffBody } from './DiffBody';

/** One file from GET /repos/{owner}/{repo}/pulls/{number}/files. `patch` is missing for binary or huge files. */
export type PrFile = {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
  blob_url: string;
};

export type DiffMode = 'unified' | 'split';

const STATUS: Partial<Record<PrFile['status'], [string, string]>> = {
  added: ['Added', 'text-success bg-success/10'],
  removed: ['Deleted', 'text-danger bg-danger/10'],
  renamed: ['Renamed', 'text-info bg-info/10'],
  copied: ['Copied', 'text-info bg-info/10'],
};

type Props = {
  file: PrFile;
  pr: PullRequest;
  queryKey: QueryKey;
  anchor?: string;
  mode: DiffMode;
  wrap: boolean;
  open: boolean;
  viewed: boolean;
  threads: ReviewThread[];
  onToggleOpen: () => void;
  onToggleViewed: () => void;
  cardRef: (el: HTMLElement | null) => void;
};

/** A file card: sticky header with view state, then the diff with inline review threads. */
export function FileDiff({ file, pr, queryKey, anchor, mode: preferredMode, wrap, open, viewed, threads, onToggleOpen, onToggleViewed, cardRef }: Props) {
  // One-sided files would leave half of a split view empty.
  const mode = file.status === 'added' || file.status === 'removed' ? 'unified' : preferredMode;
  const slash = file.filename.lastIndexOf('/');
  const status = STATUS[file.status];

  return (
    <section id={anchor} ref={cardRef} className="scroll-mt-[104px] rounded-xl border border-line bg-panel">
      <header
        className={cx(
          'sticky top-[92px] z-10 flex h-11 items-center gap-2 bg-panel/95 px-3 backdrop-blur-xl',
          open ? 'rounded-t-xl border-b border-line' : 'rounded-xl',
        )}
      >
        <button type="button" onClick={onToggleOpen} aria-label={open ? 'Collapse file' : 'Expand file'} className="flex size-6 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <ChevronRight className={cx('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <button type="button" onClick={onToggleOpen} className="min-w-0 cursor-pointer truncate text-left font-mono text-[12.5px]" title={file.filename}>
          {file.previous_filename && <span className="text-subtle">{file.previous_filename} → </span>}
          <span className="text-muted">{file.filename.slice(0, slash + 1)}</span>
          <span className="font-medium text-fg">{file.filename.slice(slash + 1)}</span>
        </button>
        <button type="button" onClick={() => copy(file.filename, 'path')} title="Copy path" className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <Copy className="size-3" />
        </button>
        {status && <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', status[1])}>{status[0]}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11.5px] tabular-nums">
          <span className="text-success">+{file.additions}</span>
          <span className="text-danger">−{file.deletions}</span>
          <DiffStat file={file} />
        </span>
        <a href={file.blob_url} title="View file" className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <FileText className="size-3.5" />
        </a>
        <button
          type="button"
          onClick={onToggleViewed}
          className={cx(
            'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors',
            viewed ? 'border-accent/40 bg-accent/12 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
          )}
        >
          <span className={cx('flex size-3.5 items-center justify-center rounded-[4px] border', viewed ? 'border-accent bg-accent text-white' : 'border-line-strong')}>
            {viewed && <Check className="size-2.5" strokeWidth={3.5} />}
          </span>
          Viewed
        </button>
      </header>

      {open &&
        (!file.patch ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-subtle">
            {file.status === 'renamed' ? 'File renamed without changes.' : 'Binary file or diff too large to display.'}{' '}
            <a href={file.blob_url} className="text-accent hover:underline">
              View file
            </a>
          </div>
        ) : (
          <LazyBody estimatedHeight={file.patch.split('\n').length * 20}>
            <DiffBody file={file} patch={file.patch} pr={pr} queryKey={queryKey} mode={mode} wrap={wrap} threads={threads} />
          </LazyBody>
        ))}
    </section>
  );
}

/** GitHub's five-square diffstat. */
function DiffStat({ file }: { file: PrFile }) {
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
 * Mounts its diff once the card comes within ~2 screens of the viewport and keeps it mounted, so a large
 * pull request doesn't render every file up front. Until then, holds roughly the diff's height.
 */
function LazyBody({ estimatedHeight, children }: { estimatedHeight: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setNear(true), { rootMargin: '2000px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return near ? children : <div ref={ref} style={{ height: estimatedHeight }} />;
}
