import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon, Comment01Icon, FilterIcon, TextWrapIcon, ViewIcon } from '@hugeicons/core-free-icons';
import { useRegisterCommands, type Command } from '@/app/commands';
import { usePageHotkey } from '@/app/keyboard';
import { gql } from '@/github/client';
import { cx } from '@/lib/cx';
import { loadDiffs } from '@/lib/diffs';
import { navigate } from '@/lib/navigation';
import { editUrl } from '@/pages/repo/urls';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import {
  MUTATIONS,
  prFilesQuery,
  prViewedQuery,
  repoPath,
  type PrHead,
  type PullRequest,
  type ReviewThread,
  type ViewedState,
} from '../query';
import { diffAnchor } from './anchor';
import { CommitPicker } from './CommitPicker';
import { BIG_FILE, FileDiff, MODE_KEY, WRAP_KEY, type DiffMode, type FileReview, type PrFile } from './FileDiff';
import { fileTypes, isShown, useFileFilter, type FileType, type Hidden } from './filter';
import { FileTree } from './FileTree';
import { ReviewPanel } from './ReviewPanel';
import { isOpenLineThread, nextOpenThread } from './threads';
import { useFileNavigation } from './useFileNavigation';

const NO_THREADS: ReviewThread[] = [];

const TYPE_LABELS: Partial<Record<FileType, string>> = { dotfile: 'Dotfiles', none: 'No extension' };

/**
 * Files changed: file tree on the left, diffs on the right, "Viewed" synced with GitHub.
 * Keys (also in the palette): n / p next or previous file, v toggle viewed, ] next unresolved thread.
 * `pr` is enough to show the files; review threads and line comments wait for the `full` pull request.
 * The filter hides viewed files, deleted files or file types, from the list, the tree and the keys.
 * With a `range` (PrRoute.range) it shows only those commits' changes. There, comments are possible only when
 * the range ends at the head commit, and only on new lines: the line numbers of old lines are the range's.
 */
export function FilesTab({ pr, full, queryKey, range, panel = false }: { pr: PrHead; full?: PullRequest; queryKey: QueryKey; range?: string; panel?: boolean }) {
  const queryClient = useQueryClient();
  const [owner, repo] = repoPath(pr).split('/') as [string, string];
  // After a push, or a pick of other commits, the previous files stay up until the new ones arrive.
  const files = useQuery({ ...prFilesQuery(owner, repo, range ?? pr), placeholderData: keepPreviousData });
  const viewedQuery = prViewedQuery(owner, repo, pr.number);
  const viewedKey = viewedQuery.queryKey;
  const viewed = useQuery(viewedQuery);
  const [mode, setMode] = useState<DiffMode>(() => (localStorage.getItem(MODE_KEY) === 'split' ? 'split' : 'unified'));
  const [wrap, setWrap] = useState(() => localStorage.getItem(WRAP_KEY) !== 'false');
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [anchors, setAnchors] = useState<Record<string, string>>({});
  const lastThread = useRef<ReviewThread>(undefined);
  const changes = files.data;
  const list = changes?.files;
  const displayedRange = changes?.range;
  // Pages render as they arrive; until the last one is in, the count comes from the pull request.
  const partial = files.isFetching && !files.isPlaceholderData;
  const atHead = !!changes && pr.headRefOid.startsWith(changes.source.oid.toLowerCase());
  const reviewThreads = useMemo(() => {
    if (!atHead || !full) return NO_THREADS;
    const all = full.reviewThreads.nodes;
    return displayedRange ? all.filter((t) => t.diffSide === 'RIGHT' || t.subjectType === 'FILE') : all;
  }, [full, displayedRange, atHead]);
  const [hidden, setHidden] = useFileFilter(panel);
  const shown = useMemo(() => {
    if (!list || !hidden?.length) return list;
    const set = new Set(hidden);
    return list.filter((f) => isShown(f, set, viewed.data?.[f.filename]));
  }, [list, hidden, viewed.data]);

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
  const { listRef, cardRef, active, currentFile, selectFile, pinFile } = useFileNavigation(shown, setOpen);
  // GitHub's editor commits to the head branch, so it is offered to people who can push there.
  const headRepo = pr.state === 'OPEN' && pr.viewerCanEditFiles ? pr.headRepository?.nameWithOwner : undefined;
  const editHref = useMemo(() => (headRepo ? (path: string) => editUrl(headRepo, pr.headRefName, path) : undefined), [headRepo, pr.headRefName]);
  const review = useMemo<FileReview>(
    () => ({ pr: atHead ? full : undefined, range: displayedRange, queryKey, onToggleViewed: toggleViewed, editHref }),
    [atHead, full, displayedRange, queryKey, toggleViewed, editHref],
  );

  const threadsByPath = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const thread of reviewThreads) map.set(thread.path, [...(map.get(thread.path) ?? []), thread]);
    return map;
  }, [reviewThreads]);

  // The grammars for the files listed so far, as each page arrives, so diffs draw in color.
  useEffect(() => {
    if (list) loadDiffs().then((renderer) => renderer.preloadHighlighting(list.map((f) => f.filename))).catch(() => {});
  }, [list]);

  // GitHub-compatible anchors (#diff-<sha256>), once every page is in: each later page would hash the whole
  // list again and jump back to the #diff- target below.
  useEffect(() => {
    if (!list || partial) return;
    Promise.all(list.map(async (f) => [f.filename, await diffAnchor(f.filename)] as const)).then((pairs) => setAnchors(Object.fromEntries(pairs)));
  }, [list, partial]);

  // Honor a #diff- anchor on arrival and on later hash changes. Wait for viewed state first: it collapses
  // files and moves everything.
  const ready = viewed.isFetched && Object.keys(anchors).length > 0;
  useEffect(() => {
    if (!ready) return;
    const scrollToHash = () => {
      const target = Object.keys(anchors).find((path) => `#${anchors[path]}` === location.hash);
      if (target) selectFile(target);
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [ready, anchors, selectFile]);

  const select = useCallback(
    (path: string, inner?: (card: HTMLElement) => Element | null) => {
      selectFile(path, inner);
      if (anchors[path]) history.replaceState(history.state, '', `#${anchors[path]}`);
    },
    [anchors, selectFile],
  );

  const step = useCallback(
    (delta: 1 | -1) => {
      const current = currentFile();
      const next = shown?.[(current ? shown.findIndex((f) => f.filename === current) : -1) + delta];
      if (next) select(next.filename);
    },
    [shown, currentFile, select],
  );

  const toggleCurrentViewed = useCallback(() => {
    const path = currentFile();
    const state = path && viewed.data?.[path];
    if (!path || !state) return;
    toggleViewed({ path, wasViewed: state === 'VIEWED' });
    // Hold the header in place as the file collapses, so the next one comes up right under it.
    pinFile(path);
  }, [currentFile, viewed.data, toggleViewed, pinFile]);

  const hasOpenThreads = reviewThreads.some(isOpenLineThread);

  /** Jumps to the unresolved thread after the last one jumped to, wrapping around. */
  const nextThread = useCallback(() => {
    const thread = nextOpenThread(reviewThreads, shown ?? [], lastThread.current);
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
  }, [reviewThreads, shown, select]);

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
  if (!changes || !list || !shown || !hidden) {
    return (
      <div className="grid gap-6 @3xl:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="hidden h-80 rounded-xl @3xl:block" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const fileCount = partial && changes.total !== undefined ? Math.min(changes.total, changes.limit) : list.length;
  const notListed = (changes.total ?? 0) - changes.limit;
  const viewedCount = list.filter((f) => isViewed(f.filename)).length;
  const deletedCount = list.filter((f) => f.status === 'removed').length;
  const filtered = shown.length < list.length;
  const filterOptions: MenuOption<Hidden>[] = [
    { value: 'viewed', label: 'Viewed files', count: viewedCount },
    ...(deletedCount ? [{ value: 'deleted' as const, label: 'Deleted files', count: deletedCount }] : []),
    ...fileTypes(list).map(([type, count]) => ({ value: type, label: TYPE_LABELS[type] ?? type, count })),
  ];
  const toggleHidden = (value: Hidden) => setHidden(hidden.includes(value) ? hidden.filter((h) => h !== value) : [...hidden, value]);
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
    <div ref={listRef} className="grid gap-6 @3xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden @3xl:sticky @3xl:top-[108px] @3xl:flex @3xl:max-h-[calc(100vh-124px)] @3xl:self-start">
        <FileTree files={shown} viewState={(path) => viewed.data?.[path]} active={active} onSelect={select} />
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="font-medium">
            {filtered && `${shown.length} of `}
            {fileCount} file{fileCount === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-2 text-muted">
            <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-elevated">
              <span className="bg-accent transition-[width]" style={{ width: `${(viewedCount / (fileCount || 1)) * 100}%` }} />
            </span>
            {viewedCount} / {fileCount} viewed
          </span>
          {!panel && <CommitPicker pr={pr} range={displayedRange} />}
          {files.isPlaceholderData && <span role="status" className="text-[12px] text-muted">Loading changes…</span>}
          <div className="ml-auto flex items-center gap-2">
            {filtered && (
              <button type="button" onClick={() => setHidden([])} className="cursor-pointer text-muted hover:text-fg">
                Clear filters
              </button>
            )}
            <button type="button" onClick={() => setAllOpen(false)} className="cursor-pointer text-muted hover:text-fg">
              Collapse all
            </button>
            <button type="button" onClick={() => setAllOpen(true)} className="cursor-pointer text-muted hover:text-fg">
              Expand all
            </button>
            <Menu
              value={filterOptions.map((o) => o.value).filter((value) => !hidden.includes(value))}
              options={filterOptions}
              onChange={toggleHidden}
              trigger={(open) => (
                <button
                  type="button"
                  onClick={open}
                  aria-haspopup="menu"
                  className={cx('flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[12px]', filtered ? 'border-line-strong bg-elevated text-fg' : 'border-line text-muted hover:text-fg')}
                >
                  <HugeiconsIcon icon={FilterIcon} className="size-3.5" />
                  Filter
                </button>
              )}
            />
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
            {full?.state === 'OPEN' && <ReviewPanel pr={full} queryKey={queryKey} />}
          </div>
        </div>

        {displayedRange && (
          <p className="rounded-xl border border-line bg-panel px-4 py-3 text-[12.5px] text-muted">
            Only the changes of the commits you picked show here.{' '}
            {list.length >= changes.limit && `GitHub lists only the first ${changes.limit.toLocaleString()} changed files of these commits. `}
            {!atHead && 'To comment, pick commits up to the latest one. '}
            <button type="button" onClick={() => navigate(`${pr.url}/files${location.search}`)} className="cursor-pointer text-accent hover:underline">
              Show all changes
            </button>
          </p>
        )}
        {notListed > 0 && (
          <p className="rounded-xl border border-line bg-panel px-4 py-3 text-[12.5px] text-muted">
            GitHub lists only the first {changes.limit.toLocaleString()} changed files. {notListed.toLocaleString()} more files do not show here or on GitHub. To see all changes, check out
            the branch.
          </p>
        )}
        {filtered && !shown.length && <p className="py-8 text-center text-[13px] text-muted">The filters hide all files.</p>}
        {shown.map((file) => (
          <FileDiff
            key={file.filename}
            file={file}
            source={changes.source}
            review={review}
            anchor={anchors[file.filename]}
            mode={mode}
            wrap={wrap}
            open={isOpen(file)}
            viewState={viewed.data?.[file.filename]}
            threads={threadsByPath.get(file.filename) ?? NO_THREADS}
            onSetOpen={setOpen}
            cardRef={cardRef}
          />
        ))}
      </div>
    </div>
  );
}
