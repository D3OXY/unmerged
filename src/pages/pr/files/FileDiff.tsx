import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Check, ChevronRight, Copy, FileText, Plus } from 'lucide-react';
import { rest } from '@/github/client';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { toast } from '@/ui/toast';
import { repoPath, type PullRequest, type ReviewThread } from '../query';
import { Thread } from '../Threads';
import { parsePatch, splitRows, type DiffLine } from './diff';
import { highlightLine, languageOf } from '@/lib/highlight';

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
type Side = 'LEFT' | 'RIGHT';
type Target = { line: number; side: Side };

const STATUS: Partial<Record<PrFile['status'], [string, string]>> = {
  added: ['Added', 'text-success bg-success/10'],
  removed: ['Deleted', 'text-danger bg-danger/10'],
  renamed: ['Renamed', 'text-info bg-info/10'],
  copied: ['Copied', 'text-info bg-info/10'],
};

/** Where a comment on this line lands: deletions on the old (LEFT) side, everything else on the new (RIGHT) side. */
const targetOf = (line: DiffLine): Target => (line.type === 'del' ? { line: line.old!, side: 'LEFT' } : { line: line.new!, side: 'RIGHT' });

type Props = {
  file: PrFile;
  pr: PullRequest;
  queryKey: QueryKey;
  anchor?: string;
  mode: DiffMode;
  open: boolean;
  viewed: boolean;
  threads: ReviewThread[];
  onToggleOpen: () => void;
  onToggleViewed: () => void;
  cardRef: (el: HTMLElement | null) => void;
};

/** A file card: sticky header with view state, then the diff with inline review threads. */
export function FileDiff({ file, pr, queryKey, anchor, mode: preferredMode, open, viewed, threads, onToggleOpen, onToggleViewed, cardRef }: Props) {
  // One-sided files would leave half of a split view empty.
  const mode = file.status === 'added' || file.status === 'removed' ? 'unified' : preferredMode;
  const hunks = useMemo(() => (file.patch ? parsePatch(file.patch) : []), [file.patch]);
  const language = languageOf(file.filename);
  const [draft, setDraft] = useState<Target | null>(null);
  const slash = file.filename.lastIndexOf('/');
  const status = STATUS[file.status];
  const lineCount = hunks.reduce((n, h) => n + h.lines.length + 1, 0);

  // Threads keyed by side and line, e.g. "RIGHT:42".
  const threadsAt = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const thread of threads) {
      if (thread.line === null) continue;
      const key = `${thread.diffSide}:${thread.line}`;
      map.set(key, [...(map.get(key) ?? []), thread]);
    }
    return map;
  }, [threads]);

  const extrasFor = (lines: (DiffLine | undefined)[]) => {
    const found = new Set<ReviewThread>();
    for (const line of lines) {
      if (!line) continue;
      if (line.type !== 'add') threadsAt.get(`LEFT:${line.old}`)?.forEach((t) => found.add(t));
      if (line.type !== 'del') threadsAt.get(`RIGHT:${line.new}`)?.forEach((t) => found.add(t));
    }
    const drafting = draft && lines.some((l) => l && targetOf(l).line === draft.line && targetOf(l).side === draft.side);
    if (!found.size && !drafting) return null;
    return (
      <div className="flex flex-col gap-2 border-y border-line bg-bg px-3 py-3 font-sans">
        {[...found].map((thread) => (
          <Thread key={thread.id} thread={thread} queryKey={queryKey} inline />
        ))}
        {drafting && <LineComposer pr={pr} path={file.filename} target={draft} queryKey={queryKey} onDone={() => setDraft(null)} />}
      </div>
    );
  };

  return (
    <section id={anchor} ref={cardRef} className="scroll-mt-[104px] rounded-xl border border-line bg-panel">
      <header className="sticky top-[92px] z-10 flex h-11 items-center gap-2 rounded-t-xl border-b border-line bg-panel/95 px-3 backdrop-blur-xl">
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
            Binary file or diff too large to display.{' '}
            <a href={file.blob_url} className="text-accent hover:underline">
              View file
            </a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-xl" style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${lineCount * 20}px` }}>
            <table className="u-diff w-full table-fixed border-collapse font-mono text-[12px] leading-5">
              <colgroup>
                {mode === 'unified' ? (
                  <>
                    <col className="w-12" />
                    <col className="w-12" />
                    <col />
                  </>
                ) : (
                  <>
                    <col className="w-12" />
                    <col />
                    <col className="w-12" />
                    <col />
                  </>
                )}
              </colgroup>
              <tbody>
                {hunks.map((hunk, h) => (
                  <Fragment key={h}>
                    <tr>
                      <td colSpan={mode === 'unified' ? 3 : 4} className="bg-accent/6 px-3 py-1 text-[11.5px] text-muted">
                        {hunk.header}
                      </td>
                    </tr>
                    {mode === 'unified'
                      ? hunk.lines.map((line, i) => (
                          <Fragment key={i}>
                            <tr className={cx('group', rowTone(line))}>
                              <Gutter n={line.old} line={line} />
                              <Gutter n={line.new} line={line} onComment={() => setDraft(targetOf(line))} />
                              <Code line={line} language={language} />
                            </tr>
                            <ExtrasRow span={3}>{extrasFor([line])}</ExtrasRow>
                          </Fragment>
                        ))
                      : splitRows(hunk.lines).map((row, i) => (
                          <Fragment key={i}>
                            <tr className="group">
                              <Gutter n={row.left?.old} line={row.left} onComment={row.left && (() => setDraft(targetOf(row.left!)))} />
                              <Code line={row.left} language={language} />
                              <Gutter n={row.right?.new} line={row.right} onComment={row.right && (() => setDraft(targetOf(row.right!)))} />
                              <Code line={row.right} language={language} />
                            </tr>
                            <ExtrasRow span={4}>{extrasFor([row.left, row.right])}</ExtrasRow>
                          </Fragment>
                        ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}

const rowTone = (line?: DiffLine) => (line?.type === 'add' ? 'bg-success/[0.08]' : line?.type === 'del' ? 'bg-danger/[0.08]' : '');

function Gutter({ n, line, onComment }: { n?: number; line?: DiffLine; onComment?: () => void }) {
  return (
    <td
      className={cx(
        'relative px-2 text-right align-top text-[11px] text-subtle tabular-nums select-none',
        line?.type === 'add' && 'bg-success/[0.12]',
        line?.type === 'del' && 'bg-danger/[0.12]',
        !line && 'bg-elevated/60',
      )}
    >
      {n}
      {onComment && (
        <button
          type="button"
          onClick={onComment}
          aria-label="Comment on this line"
          className="absolute top-0.5 -right-2.5 z-[1] hidden size-4 cursor-pointer items-center justify-center rounded bg-accent text-white shadow group-hover:flex"
        >
          <Plus className="size-3" strokeWidth={3} />
        </button>
      )}
    </td>
  );
}

function Code({ line, language }: { line?: DiffLine; language?: string }) {
  if (!line) return <td className="bg-elevated/60" />;
  return (
    <td className={cx('px-3 align-top whitespace-pre-wrap [overflow-wrap:anywhere] [tab-size:4]', rowTone(line))}>
      <span className={cx('mr-2 inline-block w-2 select-none', line.type === 'add' ? 'text-success' : line.type === 'del' ? 'text-danger' : 'text-transparent')}>
        {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
      </span>
      <span dangerouslySetInnerHTML={{ __html: highlightLine(line.text, language) }} />
    </td>
  );
}

function ExtrasRow({ span, children }: { span: number; children: ReactNode }) {
  if (!children) return null;
  return (
    <tr>
      <td colSpan={span}>{children}</td>
    </tr>
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

/** Posts a single (non-review) comment on a diff line. */
function LineComposer({ pr, path, target, queryKey, onDone }: { pr: PullRequest; path: string; target: Target; queryKey: QueryKey; onDone: () => void }) {
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: () =>
      rest(`/repos/${repoPath(pr)}/pulls/${pr.number}/comments`, {
        method: 'POST',
        body: { body: body.trim(), commit_id: pr.headRefOid, path, line: target.line, side: target.side },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      onDone();
    },
    onError: toast.error,
  });

  return (
    <div className="rounded-xl border border-line-strong bg-panel">
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) send.mutate();
          if (e.key === 'Escape') onDone();
        }}
        placeholder={`Comment on line ${target.line}…`}
        className="block w-full resize-y bg-transparent px-3 py-2.5 text-[13px] outline-none placeholder:text-subtle"
      />
      <div className="flex justify-end gap-2 border-t border-line px-2.5 py-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" disabled={!body.trim()} loading={send.isPending} onClick={() => send.mutate()}>
          Comment
        </Button>
      </div>
    </div>
  );
}
