import type { ReactNode } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  BrowserIcon,
  CheckmarkCircle02Icon,
  CircleDotIcon,
  Comment01Icon,
  FileDiffIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  Home01Icon,
  Notification03Icon,
  Search01Icon,
  Settings02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { Kbd, Logo } from './ui';

/**
 * A static rendition of Unmerged's pull request page in a browser frame, drawn with the extension's tokens.
 * Decorative: everything inside is hidden from assistive tech.
 */
export function ProductShot() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.02)] select-none"
    >
      <div className="flex h-10 items-center gap-3 border-b border-line bg-elevated/60 px-4">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
        </span>
        <span className="mx-auto flex h-6 w-full max-w-[380px] items-center justify-center rounded-md bg-bg/80 px-3 font-mono text-[11px] text-muted">
          github.com/d3oxy/unmerged/pull/27
        </span>
        <span className="w-[42px]" />
      </div>

      <div className="flex text-[13px] leading-normal">
        <AppSidebar />
        <div className="min-w-0 flex-1 px-5 pt-6 pb-7 sm:px-8">
          <h3 className="text-[19px] leading-tight font-semibold tracking-tight sm:text-[22px]">
            Review like on GitHub, but faster <span className="font-normal text-subtle">#27</span>
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[12.5px] text-muted">
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-success/15 px-2 text-[11.5px] font-medium text-success">
              <HugeiconsIcon icon={GitPullRequestIcon} className="size-3" />
              Open
            </span>
            <Person name="d3oxy" />
            <span>wants to merge 6 commits into</span>
            <Branch>main</Branch>
            <span>from</span>
            <Branch>d3oxy/review</Branch>
          </div>

          <div className="mt-5 flex items-center gap-1 overflow-hidden border-b border-line">
            <Tab icon={Comment01Icon} label="Conversation" active />
            <Tab icon={GitCommitHorizontalIcon} label="Commits" count={6} />
            <Tab icon={CheckmarkCircle02Icon} label="Checks" count={3} tone="text-success" />
            <Tab icon={FileDiffIcon} label="Files changed" count={14} className="hidden sm:flex" />
            <span className="ml-auto hidden items-center gap-2.5 pb-2 font-mono text-[11.5px] md:flex">
              <span className="text-success">+1,284</span>
              <span className="text-danger">−312</span>
              <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-elevated">
                <span className="w-[80%] bg-success" />
                <span className="w-[20%] bg-danger" />
              </span>
            </span>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_230px]">
            <div className="flex min-w-0 flex-col gap-3">
              <Card who="d3oxy" when="2h ago">
                <p>
                  Line comments now collect into one pending review, like on GitHub. Drafts survive a reload, and
                  approving offers the next pull request waiting on you.
                </p>
              </Card>
              <ReviewThread />
            </div>
            <MergeSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppSidebar() {
  return (
    <div className="hidden w-[216px] shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-3 md:flex">
      <div className="flex h-8 items-center gap-2 px-1.5">
        <Logo size={20} />
        <span className="text-[13px] font-semibold tracking-tight">Unmerged</span>
        <HugeiconsIcon icon={Settings02Icon} className="ml-auto size-3.5 text-subtle" />
      </div>
      <div className="mt-3 flex h-8 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-[12px] whitespace-nowrap text-subtle">
        <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0" />
        Search or jump to…
        <span className="ml-auto flex gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-px">
        <NavItem icon={Home01Icon} label="Home" />
        <NavItem icon={GitPullRequestIcon} label="Pull requests" active />
        <NavItem icon={CircleDotIcon} label="Issues" />
        <NavItem icon={Notification03Icon} label="Notifications" badge={4} />
        <NavItem icon={UserIcon} label="Profile" />
      </div>
      <p className="mt-5 px-2 text-[11px] font-medium text-subtle">Pinned</p>
      <div className="mt-1 flex flex-col gap-px">
        <Repo name="d3oxy/unmerged" color="bg-accent" />
        <Repo name="tanstack/router" color="bg-warning" />
        <Repo name="pierrecomputer/diffs" color="bg-info" />
      </div>
      <p className="mt-5 px-2 text-[11px] font-medium text-subtle">Repositories</p>
      <div className="mt-1 flex flex-col gap-px">
        <Repo name="d3oxy/dotfiles" color="bg-success" />
        <Repo name="wxt-dev/wxt" color="bg-merged" />
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-line px-1.5 pt-3 text-[12px] text-subtle">
        <Avatar name="d3oxy" size={20} />
        <span className="font-medium text-fg">d3oxy</span>
        <span className="ml-auto flex items-center gap-1.5">
          <HugeiconsIcon icon={BrowserIcon} className="size-3.5" />
          Classic
        </span>
      </div>
    </div>
  );
}

function ReviewThread() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line bg-elevated/50 px-3 py-2 font-mono text-[11px] text-muted">
        src/pages/pr/nextReview.ts
      </div>
      <div className="font-mono text-[11.5px] leading-[20px]">
        <DiffLine n={14} sign=" " text="export function nextReview(prs: Pr[]) {" />
        <DiffLine n={15} sign="-" text="  return prs.find((pr) => pr.reviewRequested);" />
        <DiffLine n={15} sign="+" text="  return prs.find((pr) => pr.reviewRequested && !pr.isDraft);" />
      </div>
      <div className="border-t border-line px-3 py-3">
        <div className="flex items-center gap-2 text-[12px]">
          <Avatar name="holdout" size={18} />
          <span className="font-medium">holdout</span>
          <span className="text-subtle">suggested a change</span>
          <span className="ml-auto rounded-full border border-line px-1.5 text-[10.5px] text-subtle">Pending</span>
        </div>
        <p className="mt-1.5 pl-[26px] text-muted">Drafts shouldn't count as waiting on you.</p>
      </div>
    </div>
  );
}

function MergeSidebar() {
  return (
    <div className="hidden flex-col gap-3 lg:flex">
      <div className="rounded-xl border border-line bg-panel p-3">
        <p className="text-[11px] font-medium text-subtle">Reviewers</p>
        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <Avatar name="holdout" size={18} />
          holdout
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="ml-auto size-3.5 text-success" />
        </div>
        <p className="mt-3 text-[11px] font-medium text-subtle">Labels</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Label color="#7170ff">review</Label>
          <Label color="#4cb782">perf</Label>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="flex items-center gap-2 text-[12px] font-medium">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-success" />
          All checks passed
        </div>
        <p className="mt-1 pl-6 text-[11.5px] text-subtle">3 successful · No conflicts</p>
        <div className="mt-3 flex h-8 items-center justify-center rounded-lg bg-success text-[12px] font-medium text-white">
          Squash and merge
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, badge }: { icon: IconSvgElement; label: string; active?: boolean; badge?: number }) {
  return (
    <span
      className={`flex h-7 items-center gap-2.5 rounded-md px-2 text-[12.5px] ${active ? 'bg-hover font-medium text-fg' : 'text-muted'}`}
    >
      <HugeiconsIcon icon={icon} className="size-4" />
      {label}
      {badge && <span className="ml-auto text-[11px] text-accent tabular-nums">{badge}</span>}
    </span>
  );
}

function Repo({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex h-7 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-muted">
      <span className={`size-4 rounded-[5px] ${color} opacity-80`} />
      <span className="truncate">{name}</span>
    </span>
  );
}

function Tab({
  icon,
  label,
  count,
  active,
  tone,
  className = '',
}: {
  icon: IconSvgElement;
  label: string;
  count?: number;
  active?: boolean;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-2 pb-2 text-[12.5px] ${active ? 'border-fg font-medium text-fg' : 'border-transparent text-muted'} ${className}`}
    >
      <HugeiconsIcon icon={icon} className={`size-3.5 ${tone ?? ''}`} />
      {label}
      {count !== undefined && <span className="text-[11px] text-subtle tabular-nums">{count}</span>}
    </span>
  );
}

function Card({ who, when, children }: { who: string; when: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3.5 py-3">
      <div className="flex items-center gap-2 text-[12px]">
        <Avatar name={who} size={18} />
        <span className="font-medium">{who}</span>
        <span className="text-subtle">{when}</span>
      </div>
      <div className="mt-2 text-[12.5px] leading-relaxed text-fg/90">{children}</div>
    </div>
  );
}

function DiffLine({ n, sign, text }: { n: number; sign: ' ' | '+' | '-'; text: string }) {
  const tone = sign === '+' ? 'bg-success/10' : sign === '-' ? 'bg-danger/10' : '';
  return (
    <div className={`flex whitespace-pre ${tone}`}>
      <span className="w-10 shrink-0 pr-2 text-right text-subtle">{n}</span>
      <span className="w-4 shrink-0 text-subtle">{sign}</span>
      <span className="overflow-hidden text-ellipsis text-fg/85">{text}</span>
    </div>
  );
}

function Person({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-1.5 font-medium text-fg">
      <Avatar name={name} size={18} />
      {name}
    </span>
  );
}

function Branch({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-md border border-line bg-elevated px-1.5 font-mono text-[11px] text-fg/90">
      {children}
    </span>
  );
}

function Label({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-medium"
      style={{ borderColor: `${color}55`, color, background: `${color}18` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

const AVATAR_TONES: Record<string, string> = {
  d3oxy: 'from-[#7170ff] to-[#3e306d]',
  holdout: 'from-[#ffcdac] to-[#bd715a]',
};

/** Initials on a gradient, so the mock makes no requests to GitHub. */
function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br text-[9px] font-semibold text-white uppercase ring-1 ring-line ${AVATAR_TONES[name] ?? 'from-subtle to-elevated'}`}
      style={{ width: size, height: size }}
    >
      {name[0]}
    </span>
  );
}
