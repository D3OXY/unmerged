import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon, Comment01Icon, TextWrapIcon, ViewIcon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { usePageHotkey } from '@/app/keyboard';
import { gql } from '@/github/client';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import { MUTATIONS, prFilesQuery, prViewedQuery, repoPath, type PullRequest, type ReviewThread, type ViewedState } from '../query';
import { diffAnchor } from './anchor';
import { FileDiff, type DiffMode, type PrFile } from './FileDiff';
import { FileTree } from './FileTree';
import { isOpenLineThread, nextOpenThread } from './threads';

/**
 * Scrolls a file card under the sticky headers, or `inner(card)` to the middle of the screen once it exists, and
 * keeps it there for a moment: viewed files collapse and lazily rendered diffs above it change height after
 * the first scroll. Any user input releases it.
 */
function pinScroll(card: HTMLElement, inner?: (card: HTMLElement) => Element | null) {
  const until = Date.now() + 1500;
  let released = false;
  const release = () => (released = true);
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  events.forEach((type) => window.addEventListener(type, release, { passive: true }));
  const tick = () => {
    if (released || Date.now() > until || !card.isConnected) {
      events.forEach((type) => window.removeEventListener(type, release));
      return;
    }
    const target = inner?.(card);
    if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' });
    else card.scrollIntoView({ block: 'start', behavior: 'instant' });
    requestAnimationFrame(tick);
  };
  tick();
}

const MODE_KEY = 'unmerged:diff-mode';
const WRAP_KEY = 'unmerged:diff-wrap';
const BIG_FILE = 600; // changed lines above which a file starts collapsed

const NO_THREADS: ReviewThread[] = [];

/**
 * Files changed: file tree on the left, diffs on the right, "Viewed" synced with GitHub.
 * Keys (also in the palette): n / p next or previous file, v toggle viewed, ] next unresolved thread.
 */
export function FilesTab({ pr, queryKey }: { pr: PullRequest; queryKey: QueryKey }) {
  const queryClient = useQueryClient();
  const [owner, repo] = repoPath(pr).split('/') as [string, string];
  // After a push, the previous commit's files stay up until the new ones arrive.
  const files = useQuery({ ...prFilesQuery(owner, repo, pr), placeholderData: keepPreviousData });
  const viewedQuery = prViewedQuery(owner, repo, pr.number);
  const viewedKey = viewedQuery.queryKey;
  const viewed = useQuery(viewedQuery);
  const [mode, setMode] = useState<DiffMode>(() => (localStorage.getItem(MODE_KEY) === 'split' ? 'split' : 'unified'));
  const [wrap, setWrap] = useState(() => localStorage.getItem(WRAP_KEY) !== 'false');
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string>();
  const [anchors, setAnchors] = useState<Record<string, string>>({});
  const cards = useRef(new Map<string, HTMLElement>());
  const jumped = useRef<string>(undefined);
  const lastThread = useRef<ReviewThread>(undefined);
  const list = files.data;

  const isViewed = (path: string) => viewed.data?.[path] === 'VIEWED';
  const isOpen = (file: PrFile) => openOverride[file.filename] ?? (!isViewed(file.filename) && file.changes <= BIG_FILE);

  const { mutate: toggleViewed } = useMutation({
    mutationFn: ({ path, wasViewed }: { path: string; wasViewed: boolean }) =>
      gql(wasViewed ? MUTATIONS.unmarkViewed : MUTATIONS.markViewed, { id: pr.id, path }),
    onMutate: async ({ path, wasViewed }) => {
      const next: ViewedState = wasViewed ? 'UNVIEWED' : 'VIEWED';
      setOpenOverride((o) => ({ ...o, [path]: wasViewed }));
      // A refetch already on its way would land after this and flip the box back.
      await queryClient.cancelQueries({ queryKey: viewedKey });
      queryClient.setQueryData(viewedKey, (map) => ({ ...map, [path]: next }));
    },
    onError: (error) => {
      toast.error(error);
      return queryClient.invalidateQueries({ queryKey: viewedKey });
    },
  });
  // Stable, so file cards only re-render when their own props change.
  const setOpen = useCallback((path: string, open: boolean) => setOpenOverride((o) => ({ ...o, [path]: open })), []);
  const cardRef = useCallback((path: string, el: HTMLElement | null) => {
    if (el) cards.current.set(path, el);
    else cards.current.delete(path);
  }, []);

  const threadsByPath = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const thread of pr.reviewThreads.nodes) map.set(thread.path, [...(map.get(thread.path) ?? []), thread]);
    return map;
  }, [pr.reviewThreads.nodes]);

  // GitHub-compatible anchors (#diff-<sha256>).
  useEffect(() => {
    if (!list) return;
    Promise.all(list.map(async (f) => [f.filename, await diffAnchor(f.filename)] as const)).then((pairs) => setAnchors(Object.fromEntries(pairs)));
  }, [list]);

  // Honor a #diff- anchor on arrival and on later hash changes. Wait for viewed state first: it collapses
  // files and moves everything.
  const ready = viewed.isFetched && Object.keys(anchors).length > 0;
  useEffect(() => {
    if (!ready) return;
    const scrollToHash = () => {
      const target = Object.keys(anchors).find((path) => `#${anchors[path]}` === location.hash);
      const card = target && cards.current.get(target);
      if (!card) return;
      setOpenOverride((o) => ({ ...o, [target]: true }));
      requestAnimationFrame(() => pinScroll(card));
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [ready, anchors]);

  /** The file whose card is under the sticky headers. */
  const fileInView = useCallback(() => {
    let current: string | undefined;
    for (const file of list ?? []) {
      const el = cards.current.get(file.filename);
      if (!el || el.getBoundingClientRect().top > 150) break;
      current = file.filename;
    }
    return current;
  }, [list]);

  // Track the file under the sticky headers to highlight it in the tree.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(fileInView()));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [fileInView]);

  /** Opens a file and scrolls to it, or to `inner(card)` once that exists. */
  const select = useCallback(
    (path: string, inner?: (card: HTMLElement) => Element | null) => {
      jumped.current = path;
      setOpenOverride((o) => ({ ...o, [path]: true }));
      requestAnimationFrame(() => {
        const card = cards.current.get(path);
        if (card) pinScroll(card, inner);
      });
      if (anchors[path]) history.replaceState(history.state, '', `#${anchors[path]}`);
    },
    [anchors],
  );

  /**
   * The file the keys act on: the last one jumped to while it's still on screen (near the end of the page it
   * can't reach the top), otherwise the one in view.
   */
  const currentFile = useCallback(() => {
    const card = jumped.current ? cards.current.get(jumped.current) : undefined;
    const top = card?.getBoundingClientRect().top ?? -1;
    return top >= 0 && top < innerHeight ? jumped.current : fileInView();
  }, [fileInView]);

  const step = useCallback(
    (delta: 1 | -1) => {
      const current = currentFile();
      const next = list?.[(current ? list.findIndex((f) => f.filename === current) : -1) + delta];
      if (next) select(next.filename);
    },
    [list, currentFile, select],
  );

  const toggleCurrentViewed = useCallback(() => {
    const path = currentFile();
    const state = path && viewed.data?.[path];
    if (!path || !state) return;
    toggleViewed({ path, wasViewed: state === 'VIEWED' });
    // Hold the header in place as the file collapses, so the next one comes up right under it.
    const card = cards.current.get(path);
    if (card) requestAnimationFrame(() => pinScroll(card));
  }, [currentFile, viewed.data, toggleViewed]);

  const hasOpenThreads = pr.reviewThreads.nodes.some(isOpenLineThread);

  /** Jumps to the unresolved thread after the last one jumped to, wrapping around. */
  const nextThread = useCallback(() => {
    const thread = nextOpenThread(pr.reviewThreads.nodes, list ?? [], lastThread.current);
    if (!thread) return;
    lastThread.current = thread;
    const side = thread.diffSide === 'LEFT' ? 'deletions' : 'additions';
    loadDiffs().then(
      (renderer) => {
        const slot = `[slot="${renderer.getLineAnnotationName({ side, lineNumber: thread.line })}"]`;
        select(thread.path, (card) => card.querySelector(slot));
      },
      () => select(thread.path),
    );
  }, [pr.reviewThreads.nodes, list, select]);

  usePageHotkey('n', useCallback(() => step(1), [step]));
  usePageHotkey('p', useCallback(() => step(-1), [step]));
  usePageHotkey('v', toggleCurrentViewed);
  usePageHotkey(']', nextThread);
  const commands = useMemo<Command[]>(() => {
    const group = 'Files changed';
    const entries: Command[] = [
      { id: 'pr-files:next', group, title: 'Next file', hint: 'N', icon: <HugeiconsIcon icon={ArrowDown01Icon} />, perform: () => step(1) },
      { id: 'pr-files:previous', group, title: 'Previous file', hint: 'P', icon: <HugeiconsIcon icon={ArrowUp01Icon} />, perform: () => step(-1) },
      { id: 'pr-files:viewed', group, title: 'Toggle viewed', hint: 'V', icon: <HugeiconsIcon icon={ViewIcon} />, perform: toggleCurrentViewed },
    ];
    if (hasOpenThreads) {
      entries.push({ id: 'pr-files:thread', group, title: 'Next unresolved thread', hint: ']', icon: <HugeiconsIcon icon={Comment01Icon} />, perform: nextThread });
    }
    return entries;
  }, [step, toggleCurrentViewed, nextThread, hasOpenThreads]);
  useRegisterCommands('pr-files', commands);

  if (files.error) return <p className="text-[13px] text-danger">{files.error.message}</p>;
  if (!list) {
    return (
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="hidden h-80 rounded-xl lg:block" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const viewedCount = list.filter((f) => isViewed(f.filename)).length;
  const setAllOpen = (open: boolean) => setOpenOverride(Object.fromEntries(list.map((f) => [f.filename, open])));
  const changeMode = (next: DiffMode) => {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };
  const toggleWrap = () => {
    setWrap(!wrap);
    localStorage.setItem(WRAP_KEY, String(!wrap));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-[108px] lg:flex lg:max-h-[calc(100vh-124px)] lg:self-start">
        <FileTree files={list} viewState={(path) => viewed.data?.[path]} active={active} onSelect={select} />
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="font-medium">
            {list.length} file{list.length === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-2 text-muted">
            <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-elevated">
              <span className="bg-accent transition-[width]" style={{ width: `${(viewedCount / (list.length || 1)) * 100}%` }} />
            </span>
            {viewedCount} / {list.length} viewed
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setAllOpen(false)} className="cursor-pointer text-muted hover:text-fg">
              Collapse all
            </button>
            <button type="button" onClick={() => setAllOpen(true)} className="cursor-pointer text-muted hover:text-fg">
              Expand all
            </button>
            <button
              type="button"
              onClick={toggleWrap}
              aria-pressed={wrap}
              title={wrap ? 'Long lines wrap' : 'Long lines scroll'}
              className={cx('flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[12px]', wrap ? 'border-line-strong bg-elevated text-fg' : 'border-line text-muted hover:text-fg')}
            >
              <HugeiconsIcon icon={TextWrapIcon} className="size-3.5" />
              Wrap
            </button>
            <div className="flex rounded-lg border border-line bg-panel p-0.5">
              {(['unified', 'split'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => changeMode(m)}
                  className={cx('h-6 cursor-pointer rounded-md px-2.5 text-[12px] capitalize', mode === m ? 'bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg')}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {list.map((file) => (
          <FileDiff
            key={file.filename}
            file={file}
            pr={pr}
            queryKey={queryKey}
            anchor={anchors[file.filename]}
            mode={mode}
            wrap={wrap}
            open={isOpen(file)}
            viewState={viewed.data?.[file.filename]}
            threads={threadsByPath.get(file.filename) ?? NO_THREADS}
            onSetOpen={setOpen}
            onToggleViewed={toggleViewed}
            cardRef={cardRef}
          />
        ))}
      </div>
    </div>
  );
}
