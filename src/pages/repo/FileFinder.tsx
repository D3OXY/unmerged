import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { File02Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { rest } from '@/github/client';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { Kbd } from '@/ui/primitives';
import { blobUrl } from './urls';

type GitTree = { tree: { path: string; type: 'blob' | 'tree' | 'commit' }[]; truncated: boolean };

/**
 * Fuzzy score for `query` as a subsequence of `path`, or -1 when it doesn't match. Rewards consecutive
 * characters, hits in the file name and whole-substring matches; penalizes gaps and long paths.
 */
function score(path: string, query: string) {
  const p = path.toLowerCase();
  const q = query.toLowerCase();
  const nameStart = p.lastIndexOf('/') + 1;
  let total = 0;
  let from = 0;
  let previous = -1;
  for (const ch of q) {
    const at = p.indexOf(ch, from);
    if (at === -1) return -1;
    total += (at === previous + 1 ? 3 : 1) + (at >= nameStart ? 2 : 0) - (previous >= 0 ? Math.min(at - previous - 1, 10) * 0.2 : 0);
    previous = at;
    from = at + 1;
  }
  if (p.slice(nameStart).includes(q)) total += 15;
  else if (p.includes(q)) total += 8;
  return total - path.length / 50;
}

/** "Go to file" overlay over the whole tree at `ref`. */
export function FileFinder({ nameWithOwner, gitRef, onClose }: { nameWithOwner: string; gitRef: string; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const tree = useQuery({
    queryKey: ['repo-tree', nameWithOwner, gitRef],
    queryFn: () => rest<GitTree>(`/repos/${nameWithOwner}/git/trees/${encodeURIComponent(gitRef)}?recursive=1`),
    staleTime: 5 * 60_000,
  });

  const results = useMemo(() => {
    const files = (tree.data?.tree ?? []).filter((e) => e.type === 'blob').map((e) => e.path);
    if (!query) return files.slice(0, 60);
    return files
      .map((path) => ({ path, s: score(path, query) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((r) => r.path);
  }, [tree.data, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const open = (path: string | undefined) => {
    if (!path) return;
    onClose();
    navigate(blobUrl(nameWithOwner, gitRef, path));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-[2px]" onPointerDown={onClose}>
      <div className="w-[680px] max-w-[calc(100vw-32px)] animate-pop overflow-hidden rounded-2xl border border-line-strong bg-elevated shadow-2xl shadow-black/50" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex h-12 items-center gap-3 border-b border-line px-4">
          <HugeiconsIcon icon={Search01Icon} className="size-4 text-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((i) => Math.min(results.length - 1, i + 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((i) => Math.max(0, i - 1)));
              else if (e.key === 'Enter') (e.preventDefault(), open(results[active]));
              else if (e.key === 'Escape') onClose();
            }}
            placeholder={`Go to file in ${nameWithOwner}…`}
            className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle"
          />
          <span className="font-mono text-[11.5px] text-subtle">{gitRef}</span>
        </div>
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-1.5">
          {tree.isPending && <div className="px-3 py-8 text-center text-[13px] text-subtle">Loading files…</div>}
          {tree.data && !results.length && <div className="px-3 py-8 text-center text-[13px] text-subtle">No matching files</div>}
          {results.map((path, i) => {
            const slash = path.lastIndexOf('/');
            return (
              <button
                key={path}
                type="button"
                data-active={i === active}
                onPointerMove={() => setActive(i)}
                onClick={() => open(path)}
                className={cx('flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left', i === active && 'bg-hover')}
              >
                <HugeiconsIcon icon={File02Icon} className="size-4 shrink-0 text-subtle" />
                <span className="truncate font-mono text-[12.5px]">
                  <span className="text-subtle">{path.slice(0, slash + 1)}</span>
                  {path.slice(slash + 1)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex h-10 items-center gap-4 border-t border-line px-4 text-[11.5px] text-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>esc</Kbd> close
          </span>
          {tree.data?.truncated && <span className="ml-auto">Large repo: only part of the tree is searchable</span>}
        </div>
      </div>
    </div>
  );
}
