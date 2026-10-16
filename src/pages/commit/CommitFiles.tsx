import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { TextWrapIcon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { FileDiff, type DiffMode, type PrFile } from '@/pages/pr/files/FileDiff';
import { BIG_FILE, MODE_KEY, pinScroll, WRAP_KEY } from '@/pages/pr/files/FilesTab';
import { FileTree } from '@/pages/pr/files/FileTree';
import { Empty, Panel, Skeleton } from '@/ui/primitives';
import { commitFilesQuery } from './query';

const notViewed = () => undefined;

/** A commit's changed files: the PR Files tab's tree and diffs, without review (no threads, comments or "Viewed"). */
export function CommitFiles({ owner, repo, sha }: { owner: string; repo: string; sha: string }) {
  const files = useQuery(commitFilesQuery(owner, repo, sha));
  const [mode, setMode] = useState<DiffMode>(() => (localStorage.getItem(MODE_KEY) === 'split' ? 'split' : 'unified'));
  const [wrap, setWrap] = useState(() => localStorage.getItem(WRAP_KEY) !== 'false');
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string>();
  const cards = useRef(new Map<string, HTMLElement>());
  const source = useMemo(() => ({ nameWithOwner: `${owner}/${repo}`, oid: sha }), [owner, repo, sha]);
  // Stable, so file cards only re-render when their own props change.
  const setOpen = useCallback((path: string, open: boolean) => setOpenOverride((o) => ({ ...o, [path]: open })), []);
  const cardRef = useCallback((path: string, el: HTMLElement | null) => {
    if (el) cards.current.set(path, el);
    else cards.current.delete(path);
  }, []);

  // Track the file under the sticky headers to highlight it in the tree.
  useEffect(() => {
    if (!files.data) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let current: string | undefined;
        for (const file of files.data) {
          const el = cards.current.get(file.filename);
          if (!el || el.getBoundingClientRect().top > 150) break;
          current = file.filename;
        }
        setActive(current);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [files.data]);

  if (files.error) return <p className="text-[13px] text-danger">{files.error.message}</p>;
  if (files.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="hidden h-80 rounded-xl lg:block" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const list = files.data;
  if (!list.length) {
    return (
      <Panel>
        <Empty>No files changed.</Empty>
      </Panel>
    );
  }

  const isOpen = (file: PrFile) => openOverride[file.filename] ?? file.changes <= BIG_FILE;
  const select = (path: string) => {
    setOpenOverride((o) => ({ ...o, [path]: true }));
    requestAnimationFrame(() => {
      const card = cards.current.get(path);
      if (card) pinScroll(card);
    });
  };
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
        <FileTree files={list} viewState={notViewed} active={active} onSelect={select} />
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="font-medium">
            {list.length} file{list.length === 1 ? '' : 's'} changed
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
            source={source}
            mode={mode}
            wrap={wrap}
            open={isOpen(file)}
            onSetOpen={setOpen}
            cardRef={cardRef}
          />
        ))}
      </div>
    </div>
  );
}
