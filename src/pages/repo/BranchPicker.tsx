import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, GitBranch, Search, Tag } from 'lucide-react';
import { gql } from '@/github/client';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { useDismiss } from '@/ui/useDismiss';
import { REFS_QUERY, type RefsData } from './query';
import { treeUrl } from './urls';

/** Branch/tag switcher. Switching keeps the current folder, like GitHub. */
export function BranchPicker({ owner, name, current, path }: { owner: string; name: string; current: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'branches' | 'tags'>('branches');
  const ref = useRef<HTMLDivElement>(null);
  const refs = useQuery({
    queryKey: ['repo-refs', owner, name, q],
    queryFn: () => gql<RefsData>(REFS_QUERY, { owner, name, q: q || null }),
    enabled: open,
    staleTime: 60_000,
  });

  useDismiss([ref], open, useCallback(() => setOpen(false), []));

  const items = refs.data?.repository?.[kind].nodes ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 max-w-[240px] cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[12.5px] font-medium hover:border-line-strong"
      >
        <GitBranch className="size-3.5 shrink-0 text-subtle" />
        <span className="truncate font-mono text-[12px]">{current}</span>
        <ChevronDown className="size-3.5 shrink-0 text-subtle" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 mt-1.5 w-72 animate-pop overflow-hidden rounded-xl border border-line-strong bg-elevated shadow-2xl shadow-black/30">
          <label className="flex h-10 items-center gap-2 border-b border-line px-3">
            <Search className="size-3.5 text-subtle" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Find a ${kind === 'branches' ? 'branch' : 'tag'}…`}
              className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-subtle"
            />
          </label>
          <div className="flex gap-1 border-b border-line p-1.5">
            {(['branches', 'tags'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cx('h-6 flex-1 cursor-pointer rounded-md text-[12px] capitalize', kind === k ? 'bg-hover font-medium text-fg' : 'text-muted hover:text-fg')}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {refs.isPending && <div className="px-3 py-4 text-center text-[12px] text-subtle">Loading…</div>}
            {refs.data && !items.length && <div className="px-3 py-4 text-center text-[12px] text-subtle">Nothing found</div>}
            {items.map(({ name: refName }) => (
              <button
                key={refName}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(treeUrl(`${owner}/${name}`, refName, path));
                }}
                className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[12.5px] hover:bg-hover"
              >
                {refName === current ? <Check className="size-3.5 shrink-0 text-accent" /> : kind === 'tags' ? <Tag className="size-3.5 shrink-0 text-subtle" /> : <GitBranch className="size-3.5 shrink-0 text-subtle" />}
                <span className="truncate font-mono text-[12px]">{refName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
