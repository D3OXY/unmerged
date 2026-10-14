import { useCallback, useRef, useState } from 'react';
import { ChevronDown, Code2, Copy, Download } from 'lucide-react';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { useDismiss } from '@/ui/useDismiss';
import type { Repo } from './query';

/** The "Code" button: clone URLs to copy and a ZIP download. */
export function CloneMenu({ repo, gitRef }: { repo: Repo; gitRef: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'HTTPS' | 'SSH' | 'CLI'>('HTTPS');
  const ref = useRef<HTMLDivElement>(null);
  useDismiss([ref], open, useCallback(() => setOpen(false), []));
  const value = { HTTPS: `${repo.url}.git`, SSH: repo.sshUrl, CLI: `gh repo clone ${repo.nameWithOwner}` }[kind];

  return (
    <div ref={ref} className="relative">
      <Button variant="primary" size="md" icon={<Code2 className="size-3.5" />} onClick={() => setOpen((o) => !o)}>
        Code
        <ChevronDown className="size-3.5 opacity-80" />
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-1.5 w-[360px] animate-pop rounded-xl border border-line-strong bg-elevated p-3 shadow-2xl shadow-black/30">
          <div className="flex gap-1 rounded-lg bg-bg p-0.5">
            {(['HTTPS', 'SSH', 'CLI'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cx('h-6 flex-1 cursor-pointer rounded-md text-[12px]', kind === k ? 'bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg')}
              >
                {k === 'CLI' ? 'GitHub CLI' : k}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <input readOnly value={value} onFocus={(e) => e.target.select()} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 font-mono text-[11.5px] outline-none" />
            <Button size="icon" className="size-8" aria-label="Copy" onClick={() => copy(value, 'clone command')}>
              <Copy className="size-3.5" />
            </Button>
          </div>
          <a
            href={`${repo.url}/archive/${gitRef}.zip`}
            className="mt-2.5 flex h-8 items-center gap-2 rounded-lg px-2 text-[12.5px] text-muted hover:bg-hover hover:text-fg"
          >
            <Download className="size-3.5" />
            Download ZIP
          </a>
        </div>
      )}
    </div>
  );
}
