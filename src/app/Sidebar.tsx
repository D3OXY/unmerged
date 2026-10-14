import { useState, type DragEvent, type ReactNode } from 'react';
import { Bell, ChevronDown, CircleDot, GitPullRequest, Home, Lock, PanelsTopLeft, Pin, Search, User, X } from 'lucide-react';
import { usePinnedRepos, useRecentRepos } from '@/github/repos';
import { useViewer } from '@/github/viewer';
import { openClassic } from '@/lib/classic';
import { cx } from '@/lib/cx';
import { isPinned, pin, unpin } from '@/lib/pins';
import { matchRoute } from '@/lib/routes';
import { pinsItem, useStorageItem } from '@/lib/settings';
import { Avatar, Kbd } from '@/ui/primitives';
import { paletteOpen } from './commands';
import { Logo } from './Logo';

const RECENT_SHOWN = 8;
// Set when dragging a pinned repo, so a drop inside Pinned reorders instead of re-adding.
const PIN_TYPE = 'application/x-unmerged-pin';

/** Persistent left rail: navigation, pinned repos, recent repos, organizations. */
export function Sidebar({ active }: { active?: 'home' | 'profile' }) {
  const { data: viewer } = useViewer();
  const pins = useStorageItem(pinsItem);
  const recent = useRecentRepos(viewer?.login);
  const [showAll, setShowAll] = useState(false);
  const recentRepos = (recent.data ?? []).filter((r) => !isPinned(pins, r.nameWithOwner));

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

      <div className="-mx-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:none]">
        <PinnedGroup pins={pins} viewerLogin={viewer?.login} />

        <SidebarGroup title="Repositories">
          {recentRepos.slice(0, showAll ? undefined : RECENT_SHOWN).map((repo) => (
            <RepoItem key={repo.nameWithOwner} name={repo.nameWithOwner} isPrivate={repo.isPrivate} viewerLogin={viewer?.login} />
          ))}
          {recentRepos.length > RECENT_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="flex h-7 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[12.5px] text-subtle hover:bg-hover hover:text-fg"
            >
              <ChevronDown className={cx('size-4 transition-transform', showAll && 'rotate-180')} />
              {showAll ? 'Show less' : `${recentRepos.length - RECENT_SHOWN} more`}
            </button>
          )}
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
      </div>

      <div className="flex items-center gap-2 border-t border-line px-1.5 pt-3">
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

/** "owner/name" of the repo a dragged link points at (repo, folder, file or PR URL), if any. */
function repoFromDrop(event: DragEvent) {
  const moved = event.dataTransfer.getData(PIN_TYPE);
  if (moved) return moved;
  const link = (event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')).split('\n')[0]?.trim();
  if (!link) return null;
  try {
    const route = matchRoute(new URL(link, location.href));
    return route?.kind === 'repo' || route?.kind === 'pr' ? `${route.owner}/${route.repo}` : null;
  } catch {
    return null;
  }
}

const acceptsDrop = (event: DragEvent) => ['text/uri-list', PIN_TYPE].some((t) => event.dataTransfer.types.includes(t));

/**
 * Pinned repos. Drop any repo link here to pin it (from the sidebar or any page); drag pins to reorder;
 * hover × to unpin. Also pinned from the Pin button on repo pages.
 */
function PinnedGroup({ pins, viewerLogin }: { pins: string[] | null; viewerLogin?: string }) {
  // While dragging over: the pin to insert before, or "end".
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const meta = usePinnedRepos(pins);
  const privateRepos = new Set(meta.data?.filter((r) => r.isPrivate).map((r) => r.nameWithOwner.toLowerCase()));

  const onDragOver = (event: DragEvent) => {
    if (!acceptsDrop(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes(PIN_TYPE) ? 'move' : 'copy';
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-pin]');
    setDropBefore(target?.dataset.pin ?? 'end');
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const repo = repoFromDrop(event);
    if (repo && repo !== dropBefore) pin(repo, dropBefore === 'end' ? undefined : (dropBefore ?? undefined));
    setDropBefore(null);
  };

  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setDropBefore(null)}
      onDrop={onDrop}
      className={cx('mt-5 rounded-lg transition-colors', dropBefore && 'bg-accent/8 ring-1 ring-accent/40')}
    >
      <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-medium text-subtle">
        <Pin className="size-3" />
        Pinned
      </div>
      {pins?.length ? (
        <div className="flex flex-col gap-px">
          {pins.map((name) => (
            <div key={name} data-pin={name} className="relative">
              {dropBefore === name && <span className="absolute inset-x-2 -top-px h-0.5 rounded-full bg-accent" />}
              <RepoItem
                name={name}
                isPrivate={privateRepos.has(name.toLowerCase())}
                viewerLogin={viewerLogin}
                onDragStart={(event) => event.dataTransfer.setData(PIN_TYPE, name)}
                trailing={
                  <button
                    type="button"
                    aria-label={`Unpin ${name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      unpin(name);
                    }}
                    className="ml-auto hidden size-5 cursor-pointer items-center justify-center rounded text-subtle group-hover:flex hover:bg-hover hover:text-fg"
                  >
                    <X className="size-3" />
                  </button>
                }
              />
            </div>
          ))}
        </div>
      ) : (
        pins && (
          <div className="mx-1 rounded-md border border-dashed border-line-strong px-2.5 py-2 text-[11.5px] leading-snug text-subtle">
            Drag a repo here, or use Pin on a repo page.
          </div>
        )
      )}
    </section>
  );
}

function SidebarGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
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

/** A repo link. Your own repos get a letter badge; others show their owner's avatar. */
function RepoItem({
  name,
  isPrivate,
  viewerLogin,
  trailing,
  onDragStart,
}: {
  name: string;
  isPrivate: boolean;
  viewerLogin?: string;
  trailing?: ReactNode;
  onDragStart?: (event: DragEvent) => void;
}) {
  const [owner, repo] = name.split('/') as [string, string];
  const own = owner.toLowerCase() === viewerLogin?.toLowerCase();
  return (
    <a
      href={`/${name}`}
      title={name}
      onDragStart={onDragStart}
      className="group flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg"
    >
      {own ? <RepoGlyph name={name} /> : <Avatar src={`https://avatars.githubusercontent.com/${owner}`} size={16} square />}
      {/* Short on space, the owner truncates first; the repo name only truncates once the owner is down to ~2 characters. */}
      <span className="flex min-w-0 flex-1">
        <span className="min-w-[2.5ch] truncate text-subtle group-hover:text-muted">{owner}</span>
        <span className="shrink-0 text-subtle group-hover:text-muted">/</span>
        <span className="max-w-[calc(100%-3.5ch)] shrink-0 truncate">{repo}</span>
      </span>
      {isPrivate && <Lock className={cx('ml-auto size-3 shrink-0 text-subtle', !!trailing && 'group-hover:hidden')} />}
      {trailing}
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
