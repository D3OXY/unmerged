import type { ReactNode } from 'react';
import { Bell, ChevronRight, CircleDot, GitPullRequest, Home, Lock, PanelsTopLeft, Search, User } from 'lucide-react';
import { useViewer } from '@/github/viewer';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { Avatar, Kbd } from '@/ui/primitives';
import { paletteOpen } from './commands';
import { Logo } from './Logo';

/** Linear-style frame shared by every Unmerged page: sticky sidebar + scrolling content. */
export function Shell({ children, active }: { children: ReactNode; active?: 'home' | 'profile' }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function Sidebar({ active }: { active?: 'home' | 'profile' }) {
  const { data: viewer } = useViewer();

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-3 lg:flex">
      <div className="flex h-8 items-center gap-2 px-1.5">
        <Logo />
        <span className="text-[13.5px] font-semibold tracking-tight">Unmerged</span>
      </div>

      <button
        type="button"
        onClick={() => paletteOpen.set(true)}
        className="mt-3 flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-[12.5px] text-subtle transition-colors hover:border-line-strong hover:text-muted"
      >
        <Search className="size-3.5" />
        Search or jump to…
        <span className="ml-auto flex gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <nav className="mt-4 flex flex-col gap-px">
        <NavItem href="/" icon={<Home />} active={active === 'home'}>
          Home
        </NavItem>
        <NavItem href="/pulls" icon={<GitPullRequest />}>
          Pull requests
        </NavItem>
        <NavItem href="/issues" icon={<CircleDot />}>
          Issues
        </NavItem>
        <NavItem href="/notifications" icon={<Bell />}>
          Notifications
        </NavItem>
        {viewer && (
          <NavItem href={`/${viewer.login}`} icon={<User />} active={active === 'profile'}>
            Profile
          </NavItem>
        )}
      </nav>

      <SidebarGroup title="Repositories">
        {viewer?.repositories.nodes.map((repo) => (
          <NavItem key={repo.nameWithOwner} href={`/${repo.nameWithOwner}`} icon={<RepoGlyph name={repo.nameWithOwner} />}>
            <span className="truncate">{repo.nameWithOwner.split('/')[1]}</span>
            {repo.isPrivate && <Lock className="ml-auto !size-3 shrink-0 text-subtle" />}
          </NavItem>
        ))}
      </SidebarGroup>

      {!!viewer?.organizations.nodes.length && (
        <SidebarGroup title="Organizations">
          {viewer.organizations.nodes.map((org) => (
            <NavItem key={org.login} href={`/${org.login}`} icon={<Avatar src={org.avatarUrl} size={16} square />}>
              {org.login}
            </NavItem>
          ))}
        </SidebarGroup>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-line px-1.5 pt-3">
        {viewer && (
          <a href={`/${viewer.login}`} className="flex min-w-0 items-center gap-2 rounded-md">
            <Avatar src={viewer.avatarUrl} size={22} />
            <span className="truncate text-[12.5px] font-medium">{viewer.login}</span>
          </a>
        )}
        <button
          type="button"
          onClick={openClassic}
          title="Show this page in classic GitHub"
          className="ml-auto flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] text-subtle hover:bg-hover hover:text-fg"
        >
          <PanelsTopLeft className="size-3.5" />
          Classic
        </button>
      </div>
    </aside>
  );
}

function SidebarGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 min-h-0">
      <div className="px-2 pb-1 text-[11px] font-medium text-subtle">{title}</div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  );
}

function NavItem({ href, icon, active, children }: { href: string; icon: ReactNode; active?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      className={cx(
        'flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors [&>svg]:size-4 [&>svg]:shrink-0',
        active ? 'bg-hover font-medium text-fg' : 'text-muted hover:bg-hover hover:text-fg',
      )}
    >
      {icon}
      {children}
    </a>
  );
}

/** Deterministic colored initial for repos (no avatar of their own). */
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

export type Crumb = { label: ReactNode; href?: string };

/** Sticky top bar with breadcrumbs and page actions. */
export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-line bg-bg/80 px-6 backdrop-blur-xl">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1 text-[13px]">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-subtle" />}
          {crumb.href ? (
            <a href={crumb.href} className="truncate rounded px-1 text-muted transition-colors hover:text-fg">
              {crumb.label}
            </a>
          ) : (
            <span className="truncate px-1 font-medium text-fg">{crumb.label}</span>
          )}
        </span>
      ))}
      <div className="ml-auto flex items-center gap-1.5">{actions}</div>
    </header>
  );
}
