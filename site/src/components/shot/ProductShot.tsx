import { useEffect, useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  Comment01Icon,
  ComputerTerminal01Icon,
  FileDiffIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { Avatar, Button, cx } from './bits';
import { Conversation } from './Conversation';
import { FilesChanged, type DiffMode, type RenderedDiffs } from './FilesChanged';
import { ADDITIONS, DELETIONS, FILES } from './pr';
import { Sidebar } from './Sidebar';

/** What the shot cycles through: the conversation, then the diffs, unified and split. */
const SCENES: ('conversation' | DiffMode)[] = ['conversation', 'unified', 'split'];
const SCENE_MS = 4500;

/**
 * Unmerged's pull request page in a browser frame, built from the extension's markup, tokens and (for diffs)
 * renderer. It is laid out at a real window size (`--shot-w` × `--shot-h`, narrower on phones, where the
 * extension drops its sidebar) and scaled to fit, so it shows what that window shows. Decorative and inert.
 */
export function ProductShot() {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [rendered, setRendered] = useState<RenderedDiffs>();

  // The diffs' HTML is its own chunk, fetched after first paint; the first scene doesn't need it.
  useEffect(() => {
    import('virtual:product-diffs').then(setRendered, () => {});
  }, []);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const shown = SCENES[scene]!;
  const tab = shown === 'conversation' ? 'conversation' : 'files';
  return (
    <div
      aria-hidden
      inert
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="@container [--shot-h:880px] [--shot-w:600px] select-none sm:[--shot-h:840px] sm:[--shot-w:1280px]"
    >
      <div className="relative h-[calc(var(--shot-h)*var(--k))] overflow-hidden rounded-2xl border border-line-strong bg-bg shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.02)] [--k:tan(atan2(100cqw,var(--shot-w)))]">
        <div className="flex origin-top-left flex-col text-[13px] leading-normal" style={{ width: 'var(--shot-w)', height: 'var(--shot-h)', transform: 'scale(var(--k))' }}>
          <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-elevated/60 px-4">
            <span className="flex gap-2">
              <span className="size-3 rounded-full bg-white/10" />
              <span className="size-3 rounded-full bg-white/10" />
              <span className="size-3 rounded-full bg-white/10" />
            </span>
            <span className="mx-auto flex h-7 w-full max-w-[440px] items-center justify-center rounded-md bg-bg/80 px-3 font-mono text-[12px] text-muted">
              github.com/d3oxy/unmerged/pull/27{tab === 'files' && '/files'}
            </span>
            <span className="w-[52px]" />
          </div>
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="@container min-w-0 flex-1 overflow-hidden">
              <PageHeader />
              <div className={cx('mx-auto px-6 pt-8 pb-8', tab === 'files' ? 'max-w-[1600px]' : 'max-w-[1240px]')}>
                <PrHeader />
                <TabBar tab={tab} />
                <div key={tab} className="animate-enter">
                  {shown === 'conversation' ? <Conversation /> : <FilesChanged mode={shown} rendered={rendered} />}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  const crumbs = ['d3oxy', 'unmerged', 'Pull requests', '#27'];
  return (
    <header className="flex h-12 items-center gap-1 border-b border-line bg-bg/80 px-6">
      {crumbs.map((crumb, i) => (
        <span key={crumb} className="flex min-w-0 items-center gap-1 text-[13px]">
          {i > 0 && <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 shrink-0 text-subtle" />}
          <span className={cx('truncate px-1', i === crumbs.length - 1 ? 'font-medium text-fg' : 'rounded text-muted')}>{crumb}</span>
        </span>
      ))}
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="ghost" icon={<HugeiconsIcon icon={ComputerTerminal01Icon} className="size-3.5" />}>
          Checkout
        </Button>
      </div>
    </header>
  );
}

function PrHeader() {
  return (
    <div className="max-w-[860px]">
      <h1 className="text-[24px] leading-tight font-semibold tracking-tight">
        Review like on GitHub, but faster <span className="font-normal text-subtle">#27</span>
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] text-muted">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 text-[12px] font-medium text-success">
          <HugeiconsIcon icon={GitPullRequestIcon} className="size-3.5 shrink-0 text-current" />
          Open
        </span>
        <span className="flex items-center gap-1.5 font-medium text-fg">
          <Avatar name="d3oxy" size={18} />
          d3oxy
        </span>
        <span>wants to merge 6 commits into</span>
        <BranchChip name="main" />
        <span>from</span>
        <BranchChip name="d3oxy/review" />
        <span className="text-subtle">· 5h ago</span>
      </div>
    </div>
  );
}

function BranchChip({ name }: { name: string }) {
  return (
    <span className="inline-flex h-6 max-w-[260px] items-center truncate rounded-md border border-line bg-elevated px-2 font-mono text-[11.5px] text-fg/90">
      {name}
    </span>
  );
}

function TabBar({ tab }: { tab: 'conversation' | 'files' }) {
  const total = ADDITIONS + DELETIONS;
  return (
    <nav className="-mx-6 mt-6 mb-6 flex items-center gap-1 overflow-hidden border-b border-line bg-bg/85 px-6">
      <Tab icon={<HugeiconsIcon icon={Comment01Icon} />} label="Conversation" active={tab === 'conversation'} />
      <Tab icon={<HugeiconsIcon icon={GitCommitHorizontalIcon} />} label="Commits" count={6} />
      <Tab icon={<HugeiconsIcon icon={Tick02Icon} className="text-success" strokeWidth={2.5} />} label="Checks" count={3} />
      <Tab icon={<HugeiconsIcon icon={FileDiffIcon} />} label="Files changed" count={FILES.length} active={tab === 'files'} />
      <div className="ml-auto flex shrink-0 items-center gap-3 pl-4">
        <span className="flex items-center gap-3 text-[12px]">
          <span className="font-mono text-success tabular-nums">+{ADDITIONS.toLocaleString('en')}</span>
          <span className="font-mono text-danger tabular-nums">−{DELETIONS.toLocaleString('en')}</span>
          <span className="flex h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
            <span className="bg-success" style={{ width: `${(ADDITIONS / total) * 100}%` }} />
            <span className="bg-danger" style={{ width: `${(DELETIONS / total) * 100}%` }} />
          </span>
        </span>
      </div>
    </nav>
  );
}

function Tab({ icon, label, count, active }: { icon: ReactNode; label: string; count?: number; active?: boolean }) {
  return (
    <span className={cx('relative flex h-11 shrink-0 items-center gap-2 px-3 text-[13px] transition-colors duration-200 [&_svg]:size-3.5', active ? 'font-medium text-fg' : 'text-muted')}>
      {icon}
      {label}
      {count !== undefined && <span className="rounded-full bg-elevated px-1.5 text-[11px] text-muted tabular-nums">{count}</span>}
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
    </span>
  );
}
