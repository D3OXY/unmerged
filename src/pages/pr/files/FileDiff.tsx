import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Copy01Icon, File02Icon, PencilEdit02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import type { PullRequest, ReviewThread, ViewedState } from '../query';
import { DiffBody, type DiffSource } from './DiffBody';

/** One changed file of a pull request or commit (GitHub REST). `patch` is missing for binary or huge files. */
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

/** What a pull request's cards share (one object for all of them): line comments and the "Viewed" toggle. */
export type FileReview = {
  /** Undefined until the full pull request loads; line comments wait for it. */
  pr?: PullRequest;
  queryKey: QueryKey;
  onToggleViewed: (change: { path: string; wasViewed: boolean }) => void;
  /** GitHub's editor for a file on the head branch; undefined when the viewer can't push there. */
  editHref?: (path: string) => string;
};

const NO_THREADS: ReviewThread[] = [];

type Props = {
  file: PrFile;
  source: DiffSource;
  /** Pull requests only; commits show the diff without review controls. */
  review?: FileReview;
  anchor?: string;
  mode: DiffMode;
  wrap: boolean;
  open: boolean;
  /** Pull requests: undefined until the viewer's marks load. */
  viewState?: ViewedState;
  threads?: ReviewThread[];
  // Shared by every card (they take the path), so a card re-renders only when its own props change.
  onSetOpen: (path: string, open: boolean) => void;
  cardRef: (path: string, el: HTMLElement | null) => void;
};

/**
 * A file card: sticky header with view state, then the diff with inline review threads. Until the card comes
 * within ~2 screens of the viewport it is only its path at roughly its full height, so a pull request with
 * thousands of files mounts fast. It stays the same element (anchors, refs and scroll pins hold) and stays
 * mounted once near.
 */
export const FileDiff = memo(function FileDiff({ file, source, review, anchor, mode: preferredMode, wrap, open, viewState, threads = NO_THREADS, onSetOpen, cardRef }: Props) {
  const section = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!near && section.current) return whenNear(section.current, () => setNear(true));
  }, [near]);
  const viewed = viewState === 'VIEWED';
  const onToggleOpen = () => onSetOpen(file.filename, !open);
  // One-sided files would leave half of a split view empty.
  const mode = file.status === 'added' || file.status === 'removed' ? 'unified' : preferredMode;
  const slash = file.filename.lastIndexOf('/');
  const status = STATUS[file.status];

  const ref = (el: HTMLElement | null) => {
    section.current = el;
    cardRef(file.filename, el);
  };
  if (!near) {
    // 46 px: the header and the card's borders.
    return (
      <section id={anchor} ref={ref} style={{ height: 46 + (open ? bodyHeight(file) : 0) }} className="scroll-mt-[104px] rounded-xl border border-line bg-panel">
        <p className="truncate pr-3 pl-11 font-mono text-[12.5px] leading-[44px] text-muted">{file.filename}</p>
      </section>
    );
  }

  return (
    <section id={anchor} ref={ref} className="scroll-mt-[104px] rounded-xl border border-line bg-panel">
      <header
        className={cx(
          'sticky top-[92px] z-10 flex h-11 items-center gap-2 bg-panel/95 px-3 backdrop-blur-xl',
          open ? 'rounded-t-xl border-b border-line' : 'rounded-xl',
        )}
      >
        <button type="button" onClick={onToggleOpen} aria-label={open ? 'Collapse file' : 'Expand file'} className="flex size-6 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <HugeiconsIcon icon={ArrowRight01Icon} className={cx('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <button type="button" onClick={onToggleOpen} className="min-w-0 cursor-pointer truncate text-left font-mono text-[12.5px]" title={file.filename}>
          {file.previous_filename && <span className="text-subtle">{file.previous_filename} → </span>}
          <span className="text-muted">{file.filename.slice(0, slash + 1)}</span>
          <span className="font-medium text-fg">{file.filename.slice(slash + 1)}</span>
        </button>
        <button type="button" onClick={() => copy(file.filename, 'path')} title="Copy path" className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <HugeiconsIcon icon={Copy01Icon} className="size-3" />
        </button>
        {status && <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', status[1])}>{status[0]}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11.5px] tabular-nums">
          <span className="text-success">+{file.additions}</span>
          <span className="text-danger">−{file.deletions}</span>
          <DiffStat file={file} />
        </span>
        <a href={file.blob_url} title="View file" className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <HugeiconsIcon icon={File02Icon} className="size-3.5" />
        </a>
        {review?.editHref && file.status !== 'removed' && (
          <a href={review.editHref(file.filename)} title="Edit file" aria-label="Edit file" className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-3.5" />
          </a>
        )}
        {viewState === 'DISMISSED' && (
          <span title="Changed since you marked it viewed" className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
            Changed since viewed
          </span>
        )}
        {review && (
          <button
            type="button"
            onClick={() => review.onToggleViewed({ path: file.filename, wasViewed: viewed })}
            disabled={!viewState}
            className={cx(
              'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors disabled:cursor-default',
              viewed ? 'border-accent/40 bg-accent/12 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            <span className={cx('flex size-3.5 items-center justify-center rounded-[4px] border', viewed ? 'border-accent bg-accent text-white' : 'border-line-strong')}>
              {viewed && <HugeiconsIcon icon={Tick02Icon} className="size-2.5" strokeWidth={3.5} />}
            </span>
            Viewed
          </button>
        )}
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
          <LazyBody estimatedHeight={bodyHeight(file)}>
            <DiffBody file={file} patch={file.patch} source={source} review={review?.pr && { pr: review.pr, queryKey: review.queryKey, threads }} mode={mode} wrap={wrap} />
          </LazyBody>
        ))}
    </section>
  );
});

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

/** Roughly how tall an open card's body is before its diff mounts: 20 px a line. Counts lines without a split, for thousands of files. */
function bodyHeight({ patch }: PrFile) {
  if (!patch) return 66;
  let lines = 1;
  for (let i = patch.indexOf('\n'); i !== -1; i = patch.indexOf('\n', i + 1)) lines++;
  return lines * 20;
}

// One observer for every card and diff: thousands of observers cost more than one that watches thousands.
const waiting = new Map<Element, () => void>();
let nearObserver: IntersectionObserver | undefined;

/** Calls `onNear` once, when `el` comes within ~2 screens of the viewport. Returns a function that stops waiting. */
function whenNear(el: Element, onNear: () => void) {
  nearObserver ??= new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        const callback = entry.isIntersecting && waiting.get(entry.target);
        if (!callback) continue;
        waiting.delete(entry.target);
        observer.unobserve(entry.target);
        callback();
      }
    },
    { rootMargin: '2000px 0px' },
  );
  waiting.set(el, onNear);
  nearObserver.observe(el);
  return () => {
    waiting.delete(el);
    nearObserver?.unobserve(el);
  };
}

// A diff highlights as it mounts, synchronously. Mounted together (every card near the viewport at once) they
// make one long task and nothing paints until the last is done, so they mount one per frame, in page order.
const mountQueue: (() => void)[] = [];
let draining = false;
function mountInTurn(mount: () => void) {
  mountQueue.push(mount);
  if (draining) return;
  draining = true;
  const next = () => {
    const mountNext = mountQueue.shift();
    if (!mountNext) {
      draining = false;
      return;
    }
    mountNext();
    // After the frame that paints this diff.
    requestAnimationFrame(() => setTimeout(next));
  };
  next();
}

/**
 * Mounts its diff once the card comes near the viewport (see whenNear and mountInTurn) and keeps it mounted, so
 * a large pull request doesn't render every file up front. Until then, holds roughly its height.
 */
function LazyBody({ estimatedHeight, children }: { estimatedHeight: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!near && ref.current) return whenNear(ref.current, () => mountInTurn(() => setNear(true)));
  }, [near]);
  return near ? children : <div ref={ref} style={{ height: estimatedHeight }} />;
}
