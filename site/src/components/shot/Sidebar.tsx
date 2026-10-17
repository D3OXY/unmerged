import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  BrowserIcon,
  CircleDotIcon,
  GitPullRequestIcon,
  Home01Icon,
  Moon02Icon,
  Notification03Icon,
  PinIcon,
  Search01Icon,
  Settings02Icon,
  SquareLock02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { Kbd, Logo } from '../ui';
import { Avatar, cx } from './bits';

const VIEWER = 'd3oxy';

/** The extension's left rail (src/app/Sidebar.tsx) on the Pull requests section. */
export function Sidebar() {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-3 sm:flex">
      <div className="flex h-8 items-center gap-2 px-1.5">
        <Logo />
        <span className="text-[13.5px] font-semibold tracking-tight">Unmerged</span>
        <span className="-mr-1 ml-auto flex size-7 items-center justify-center rounded-md text-subtle">
          <HugeiconsIcon icon={Settings02Icon} className="size-4" />
        </span>
      </div>

      <div className="mt-3 flex h-8 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-[12.5px] text-subtle">
        <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0" />
        <span className="truncate">Search or jump to…</span>
        <span className="ml-auto flex shrink-0 gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>

      <nav className="mt-4 flex flex-col gap-px">
        <NavItem icon={<HugeiconsIcon icon={Home01Icon} />}>Home</NavItem>
        <NavItem icon={<HugeiconsIcon icon={GitPullRequestIcon} />} active>
          Pull requests
        </NavItem>
        <NavItem icon={<HugeiconsIcon icon={CircleDotIcon} />}>Issues</NavItem>
        <NavItem icon={<HugeiconsIcon icon={Notification03Icon} />}>
          Notifications
          <span className="ml-auto rounded-full bg-accent/15 px-1.5 text-[11px] font-medium text-accent tabular-nums">4</span>
        </NavItem>
        <NavItem icon={<HugeiconsIcon icon={UserIcon} />}>Profile</NavItem>
      </nav>

      <div className="min-h-0 flex-1">
        <section className="mt-5">
          <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-medium text-subtle">
            <HugeiconsIcon icon={PinIcon} className="size-3" />
            Pinned
          </div>
          <div className="flex flex-col gap-px">
            <RepoItem name="d3oxy/unmerged" />
            <RepoItem name="tanstack/router" />
            <RepoItem name="pierrecomputer/diffs" />
          </div>
        </section>

        <div className="mt-5">
          <div className="px-2 pb-1 text-[11px] font-medium text-subtle">Repositories</div>
          <div className="flex flex-col gap-px">
            <RepoItem name="d3oxy/dotfiles" isPrivate />
            <RepoItem name="wxt-dev/wxt" />
            <RepoItem name="d3oxy/deoxy.dev" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-1.5 pt-3">
        <span className="flex min-w-0 items-center gap-2 rounded-md">
          <Avatar name={VIEWER} size={22} />
          <span className="truncate text-[12.5px] font-medium">{VIEWER}</span>
        </span>
        <span className="ml-auto flex size-7 items-center justify-center rounded-md text-subtle">
          <HugeiconsIcon icon={Moon02Icon} className="size-3.5" />
        </span>
        <span className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-subtle">
          <HugeiconsIcon icon={BrowserIcon} className="size-3.5" />
          Classic
        </span>
      </div>
    </aside>
  );
}

function NavItem({ icon, active, children }: { icon: ReactNode; active?: boolean; children: ReactNode }) {
  return (
    <span
      className={cx(
        'flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] [&>svg]:size-4 [&>svg]:shrink-0',
        active ? 'bg-hover font-medium text-fg' : 'text-muted',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Your own repos get a letter badge; others show their owner's avatar. */
function RepoItem({ name, isPrivate }: { name: string; isPrivate?: boolean }) {
  const [owner, repo] = name.split('/') as [string, string];
  return (
    <span className="group flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted">
      {owner === VIEWER ? <RepoGlyph name={name} /> : <Avatar name={owner} size={16} square />}
      <span className="flex min-w-0 flex-1">
        <span className="min-w-[2.5ch] truncate text-subtle">{owner}</span>
        <span className="shrink-0 text-subtle">/</span>
        <span className="max-w-[calc(100%-3.5ch)] shrink-0 truncate">{repo}</span>
      </span>
      {isPrivate && <HugeiconsIcon icon={SquareLock02Icon} className="ml-auto size-3 shrink-0 text-subtle" />}
    </span>
  );
}

/** The extension's deterministic colored initial for a repo. */
function RepoGlyph({ name }: { name: string }) {
  const repo = name.split('/')[1] ?? name;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (
    <span
      className="flex size-4 shrink-0 items-center justify-center rounded text-[9.5px] font-semibold text-white uppercase"
      style={{ background: `oklch(0.62 0.13 ${Math.abs(hash) % 360})` }}
    >
      {repo[0]}
    </span>
  );
}
