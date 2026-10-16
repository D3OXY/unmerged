import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { FileDiff as DiffInstance, SelectedLineRange } from '@pierre/diffs';
import { gql, rest } from '@/github/client';
import { loadDiffs } from '@/lib/diffs';
import { useIsDark } from '@/lib/settings';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import { repoPath, type PullRequest, type ReviewThread } from '../query';
import { Thread } from '../Threads';
import { gitPatch, oldContents } from './diff';
import type { DiffMode, PrFile } from './FileDiff';

type Side = 'additions' | 'deletions';
/** Lines picked for a new comment; GitHub anchors it at `end` and, for a range, starts it at `start`. */
type Draft = { start: number; startSide: Side; end: number; side: Side };
/** What hangs under one diff line: its review threads and, maybe, the composer. */
type Note = { side: Side; line: number; threads: ReviewThread[]; draft?: Draft };

const FILE_QUERY = /* GraphQL */ `
  query FileAt($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) { object(expression: $expression) { ... on Blob { text } } }
  }
`;

// Unmerged's surfaces, type and diff colors, applied in the renderer's highest-priority layer.
const UNSAFE_CSS = `:host {
  --diffs-light-bg: var(--u-panel);
  --diffs-dark-bg: var(--u-panel);
  --diffs-font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --diffs-header-font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --diffs-font-size: 12px;
  --diffs-line-height: 20px;
  --diffs-addition-color: var(--u-green);
  --diffs-deletion-color: var(--u-red);
  --diffs-modified-color: var(--u-blue);
}`;

const sideOf = (thread: ReviewThread): Side => (thread.diffSide === 'LEFT' ? 'deletions' : 'additions');
const githubSide = (side: Side) => (side === 'deletions' ? 'LEFT' : 'RIGHT');

/**
 * A file's diff, drawn by `@pierre/diffs` (loaded on demand, see src/lib/diffs.ts) with Shiki highlighting,
 * word-level changes and expandable context. Review threads and the comment composer are React, slotted
 * under their lines.
 */
export function DiffBody({ file, patch, pr, queryKey, mode, wrap, threads }: {
  file: PrFile;
  patch: string;
  pr: PullRequest;
  queryKey: QueryKey;
  mode: DiffMode;
  wrap: boolean;
  threads: ReviewThread[];
}) {
  const renderer = useQuery({ queryKey: ['diffs-renderer'], queryFn: loadDiffs, staleTime: Infinity, gcTime: Infinity });
  const api = renderer.data;
  const dark = useIsDark();
  const [draft, setDraft] = useState<Draft | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<DiffInstance<undefined>>(undefined);

  const fileDiff = useMemo(() => api?.getSingularPatch(gitPatch(file, patch)), [api, file, patch]);

  const notes = useMemo(() => {
    const byLine = new Map<string, Note>();
    const noteAt = (side: Side, line: number) => {
      const key = `${side}:${line}`;
      const note = byLine.get(key) ?? { side, line, threads: [] };
      byLine.set(key, note);
      return note;
    };
    for (const thread of threads) if (thread.line !== null) noteAt(sideOf(thread), thread.line).threads.push(thread);
    if (draft) noteAt(draft.side, draft.end).draft = draft;
    return [...byLine.values()];
  }, [threads, draft]);
  const annotations = useMemo(() => notes.map(({ side, line }) => ({ side, lineNumber: line })), [notes]);

  const options = useMemo(
    () => ({
      theme: { dark: 'pierre-dark', light: 'pierre-light' },
      themeType: dark ? ('dark' as const) : ('light' as const),
      diffStyle: mode,
      overflow: wrap ? ('wrap' as const) : ('scroll' as const),
      lineDiffType: 'word-alt' as const,
      diffIndicators: 'bars' as const,
      hunkSeparators: 'line-info' as const,
      disableFileHeader: true,
      enableGutterUtility: true,
      enableLineSelection: true,
      unsafeCSS: UNSAFE_CSS,
      onGutterUtilityClick: ({ start, side = 'additions', end, endSide = side }: SelectedLineRange) =>
        setDraft(start <= end ? { start, startSide: side, end, side: endSide } : { start: end, startSide: endSide, end: start, side }),
      // Full files are only fetched when someone expands unchanged lines.
      loadDiffFiles: async () => {
        const [owner, repo] = repoPath(pr).split('/');
        const { repository } = await gql<{ repository: { object: { text: string | null } | null } }>(FILE_QUERY, {
          owner,
          repo,
          expression: `${pr.headRefOid}:${file.filename}`,
        });
        const text = repository.object?.text ?? '';
        return {
          oldFile: { name: file.previous_filename ?? file.filename, contents: oldContents(text, patch) },
          newFile: { name: file.filename, contents: text },
        };
      },
    }),
    [dark, mode, wrap, pr.url, pr.headRefOid, file, patch],
  );

  useLayoutEffect(() => {
    const container = host.current;
    if (!api || !container || !fileDiff) return;
    let diff = instance.current;
    if (!diff) {
      api.prepareContainer(container);
      // `true`: React owns the container's children (the slotted notes).
      diff = instance.current = new api.FileDiff<undefined>(options, undefined, true);
      diff.render({ fileDiff, fileContainer: container, lineAnnotations: annotations });
      return;
    }
    const optionsChanged = diff.options !== options;
    diff.setOptions(options);
    diff.render({ fileDiff, lineAnnotations: annotations, forceRender: optionsChanged });
  }, [api, fileDiff, options, annotations]);

  useEffect(
    () => () => {
      instance.current?.cleanUp();
      instance.current = undefined;
    },
    [],
  );

  if (renderer.error) {
    return (
      <div className="px-4 py-6 text-center text-[12.5px] text-danger">
        {renderer.error.message}.{' '}
        <button type="button" onClick={() => renderer.refetch()} className="cursor-pointer text-accent hover:underline">
          Retry
        </button>
      </div>
    );
  }
  if (!api) return <Skeleton className="m-3 h-24 rounded-lg" />;

  return (
    <div ref={host} className="block overflow-hidden rounded-b-xl">
      {notes.map((note) => (
        <div
          key={`${note.side}:${note.line}`}
          slot={api.getLineAnnotationName({ side: note.side, lineNumber: note.line })}
          className="flex flex-col gap-2 border-y border-line bg-bg px-3 py-3 font-sans text-[13px] leading-normal whitespace-normal"
        >
          {note.threads.map((thread) => (
            <Thread key={thread.id} thread={thread} queryKey={queryKey} inline />
          ))}
          {note.draft && <LineComposer pr={pr} path={file.filename} draft={note.draft} queryKey={queryKey} onDone={() => setDraft(null)} />}
        </div>
      ))}
    </div>
  );
}

/** Posts a single (non-review) comment on a line or a range of lines. */
function LineComposer({ pr, path, draft, queryKey, onDone }: { pr: PullRequest; path: string; draft: Draft; queryKey: QueryKey; onDone: () => void }) {
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();
  const range = draft.start !== draft.end || draft.startSide !== draft.side;
  const send = useMutation({
    mutationFn: () =>
      rest(`/repos/${repoPath(pr)}/pulls/${pr.number}/comments`, {
        method: 'POST',
        body: {
          body: body.trim(),
          commit_id: pr.headRefOid,
          path,
          line: draft.end,
          side: githubSide(draft.side),
          ...(range && { start_line: draft.start, start_side: githubSide(draft.startSide) }),
        },
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
        placeholder={range ? `Comment on lines ${draft.start}–${draft.end}…` : `Comment on line ${draft.end}…`}
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
