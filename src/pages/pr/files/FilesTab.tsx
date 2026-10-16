import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { WrapText } from 'lucide-react';
import { gql, rest } from '@/github/client';
import { cx } from '@/lib/cx';
import { Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import { MUTATIONS, repoPath, type PullRequest, type ReviewThread } from '../query';
import { diffAnchor } from './anchor';
import { FileDiff, type DiffMode, type PrFile } from './FileDiff';
import { FileTree } from './FileTree';

const VIEWED_QUERY = /* GraphQL */ `
  query PrViewed($id: ID!, $after: String) {
    node(id: $id) {
      ... on PullRequest {
        files(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { path viewerViewedState } }
      }
    }
  }
`;

type ViewedState = 'VIEWED' | 'UNVIEWED' | 'DISMISSED';
type ViewedPage = {
  node: { files: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { path: string; viewerViewedState: ViewedState }[] } };
};

/** Every changed file with its patch. GitHub serves at most 3000 files, 100 per page. */
async function fetchFiles(pr: PullRequest) {
  const files: PrFile[] = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await rest<PrFile[]>(`/repos/${repoPath(pr)}/pulls/${pr.number}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

/** The viewer's "Viewed" marks, shared with GitHub. */
async function fetchViewed(id: string) {
  const viewed: Record<string, ViewedState> = {};
  let after: string | null = null;
  do {
    const page: ViewedPage = await gql<ViewedPage>(VIEWED_QUERY, { id, after });
    for (const file of page.node.files.nodes) viewed[file.path] = file.viewerViewedState;
    after = page.node.files.pageInfo.hasNextPage ? page.node.files.pageInfo.endCursor : null;
  } while (after);
  return viewed;
}

/**
 * Scrolls a file card under the sticky headers and keeps it there for a moment: viewed files collapse and
 * lazily rendered diffs above it change height after the first scroll. Any user input releases it.
 */
function pinScroll(el: HTMLElement) {
  const until = Date.now() + 1500;
  let released = false;
  const release = () => (released = true);
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  events.forEach((type) => window.addEventListener(type, release, { passive: true }));
  const tick = () => {
    if (released || Date.now() > until || !el.isConnected) {
      events.forEach((type) => window.removeEventListener(type, release));
      return;
    }
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
    requestAnimationFrame(tick);
  };
  tick();
}

const MODE_KEY = 'unmerged:diff-mode';
const WRAP_KEY = 'unmerged:diff-wrap';
const BIG_FILE = 600; // changed lines above which a file starts collapsed

/** Files changed: file tree on the left, diffs on the right, "Viewed" synced with GitHub. */
export function FilesTab({ pr, queryKey }: { pr: PullRequest; queryKey: QueryKey }) {
  const queryClient = useQueryClient();
  const files = useQuery({ queryKey: ['pr-files', pr.id, pr.headRefOid], queryFn: () => fetchFiles(pr), staleTime: 5 * 60_000 });
  const viewedKey = ['pr-viewed', pr.id];
  const viewed = useQuery({ queryKey: viewedKey, queryFn: () => fetchViewed(pr.id) });
  const [mode, setMode] = useState<DiffMode>(() => (localStorage.getItem(MODE_KEY) === 'split' ? 'split' : 'unified'));
  const [wrap, setWrap] = useState(() => localStorage.getItem(WRAP_KEY) !== 'false');
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string>();
  const [anchors, setAnchors] = useState<Record<string, string>>({});
  const cards = useRef(new Map<string, HTMLElement>());

  const isViewed = (path: string) => viewed.data?.[path] === 'VIEWED';
  const isOpen = (file: PrFile) => openOverride[file.filename] ?? (!isViewed(file.filename) && file.changes <= BIG_FILE);

  const toggleViewed = useMutation({
    mutationFn: ({ path, wasViewed }: { path: string; wasViewed: boolean }) =>
      gql(wasViewed ? MUTATIONS.unmarkViewed : MUTATIONS.markViewed, { id: pr.id, path }),
    onMutate: ({ path, wasViewed }) => {
      queryClient.setQueryData<Record<string, ViewedState>>(viewedKey, (map) => ({ ...map, [path]: wasViewed ? 'UNVIEWED' : 'VIEWED' }));
      setOpenOverride((o) => ({ ...o, [path]: wasViewed }));
    },
    onError: (error) => {
      toast.error(error);
      return queryClient.invalidateQueries({ queryKey: viewedKey });
    },
  });

  const threadsByPath = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const thread of pr.reviewThreads.nodes) map.set(thread.path, [...(map.get(thread.path) ?? []), thread]);
    return map;
  }, [pr.reviewThreads.nodes]);

  // GitHub-compatible anchors (#diff-<sha256>).
  useEffect(() => {
    if (!files.data) return;
    Promise.all(files.data.map(async (f) => [f.filename, await diffAnchor(f.filename)] as const)).then((pairs) => setAnchors(Object.fromEntries(pairs)));
  }, [files.data]);

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
  const viewedCount = list.filter((f) => isViewed(f.filename)).length;

  const select = (path: string) => {
    setOpenOverride((o) => ({ ...o, [path]: true }));
    requestAnimationFrame(() => {
      const card = cards.current.get(path);
      if (card) pinScroll(card);
    });
    if (anchors[path]) history.replaceState(history.state, '', `#${anchors[path]}`);
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
        <FileTree files={list} viewed={isViewed} active={active} onSelect={select} />
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
              <WrapText className="size-3.5" />
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
            viewed={isViewed(file.filename)}
            threads={threadsByPath.get(file.filename) ?? []}
            onToggleOpen={() => setOpenOverride((o) => ({ ...o, [file.filename]: !isOpen(file) }))}
            onToggleViewed={() => toggleViewed.mutate({ path: file.filename, wasViewed: isViewed(file.filename) })}
            cardRef={(el) => {
              if (el) cards.current.set(file.filename, el);
              else cards.current.delete(file.filename);
            }}
          />
        ))}
      </div>
    </div>
  );
}
