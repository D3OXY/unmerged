import type { ReviewThread } from '../query';
import type { PrFile } from './FileDiff';

/**
 * The open thread after `last` in page order (file order, then line), wrapping around to the first: the `]`
 * key. `last` may have been resolved since.
 */
export function nextOpenThread(threads: ReviewThread[], files: PrFile[], last?: ReviewThread) {
  const index = new Map(files.map((f, i) => [f.filename, i]));
  const order = (a: ReviewThread, b: ReviewThread) =>
    (index.get(a.path) ?? 0) - (index.get(b.path) ?? 0) || (a.line ?? 0) - (b.line ?? 0) || a.id.localeCompare(b.id);
  const open = threads.filter(isOpenLineThread).sort(order);
  return (last && open.find((t) => order(t, last) > 0)) || open[0];
}

/** An unresolved thread anchored to a diff line, so `]` can jump to it. */
export const isOpenLineThread = (t: ReviewThread): t is ReviewThread & { line: number } => !t.isResolved && isLineThread(t);

/** A thread on a line of the diff: not on the whole file, and not outdated (no line). */
export const isLineThread = (t: ReviewThread): t is ReviewThread & { line: number } => t.subjectType !== 'FILE' && t.line !== null;
