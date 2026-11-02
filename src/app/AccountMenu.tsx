import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  AccessIcon,
  Book02Icon,
  Building03Icon,
  CopilotIcon,
  FavouriteIcon,
  Globe02Icon,
  Logout01Icon,
  PaintBrush02Icon,
  Settings02Icon,
  SourceCodeSquareIcon,
  StarIcon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import type { Viewer } from '@/github/viewer';
import { Avatar } from '@/ui/primitives';
import { useDismiss } from '@/ui/useDismiss';

type Link = { label: string; href: string; icon: IconSvgElement };

/** GitHub's account menu, in its groups. Links to pages that Unmerged does not own load GitHub's page. */
const linkGroups = (login: string): Link[][] => [
  [
    { label: 'Profile', href: `/${login}`, icon: UserIcon },
    { label: 'Repositories', href: `/${login}?tab=repositories`, icon: Book02Icon },
    { label: 'Stars', href: `/${login}?tab=stars`, icon: StarIcon },
    { label: 'Gists', href: 'https://gist.github.com/mine', icon: SourceCodeSquareIcon },
    { label: 'Organizations', href: '/settings/organizations', icon: Building03Icon },
    { label: 'Enterprises', href: '/settings/enterprises', icon: Globe02Icon },
    { label: 'Sponsors', href: '/sponsors/accounts', icon: FavouriteIcon },
  ],
  [
    { label: 'Settings', href: '/settings/profile', icon: Settings02Icon },
    { label: 'Copilot settings', href: '/settings/copilot', icon: CopilotIcon },
    { label: 'Appearance', href: '/settings/appearance', icon: PaintBrush02Icon },
    { label: 'Accessibility', href: '/settings/accessibility', icon: AccessIcon },
  ],
  [{ label: 'Sign out', href: '/logout', icon: Logout01Icon }],
];

/**
 * The sidebar's account button. It opens GitHub's account menu above it, inside the sidebar's width, so the
 * sidebar never clips it. ↑/↓, Home and End move between links; Escape or Tab closes it.
 */
export function AccountMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismiss([triggerRef, panelRef], open, useCallback(() => setOpen(false), []));
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.findIndex((item) => item === e.target);
    const moves: Record<string, HTMLElement | undefined> = { ArrowDown: items[(index + 1) % items.length], ArrowUp: items.at(index - 1), Home: items[0], End: items.at(-1) };
    const target = moves[e.key];
    if (!target && e.key !== 'Escape' && e.key !== 'Tab') return;
    e.preventDefault();
    if (target) target.focus();
    else close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        className="-ml-1 flex min-w-0 cursor-pointer items-center gap-2 rounded-md py-0.5 pr-1.5 pl-1 hover:bg-hover"
      >
        <Avatar src={viewer.avatarUrl} size={22} />
        <span className="truncate text-[12.5px] font-medium">{viewer.login}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onKeyDown}
          // Links navigate through the content script's click handler; close once one is followed.
          onClick={(e) => (e.target as Element).closest('a') && setOpen(false)}
          className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-[calc(100vh-4rem)] origin-bottom animate-pop overflow-y-auto rounded-xl border border-line-strong bg-elevated p-1 shadow-2xl shadow-black/30"
        >
          <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-1.5">
            <Avatar src={viewer.avatarUrl} size={32} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{viewer.login}</div>
              {viewer.name && <div className="truncate text-[12px] text-muted">{viewer.name}</div>}
            </div>
          </div>
          {viewer.status?.message && (
            <div className="flex items-center gap-2 px-2.5 pb-2 text-[12.5px] text-muted">
              {/* GitHub-sanitized HTML: a <g-emoji> or a custom emoji's <img>. */}
              {viewer.status.emojiHTML && <span className="shrink-0 [&_img]:size-4" dangerouslySetInnerHTML={{ __html: viewer.status.emojiHTML }} />}
              <span className="truncate">{viewer.status.message}</span>
            </div>
          )}
          {linkGroups(viewer.login).map((group, i) => (
            <div key={i} role="group" className="border-t border-line pt-1 not-last:pb-1">
              {group.map(({ label, href, icon }) => (
                <a key={label} href={href} role="menuitem" tabIndex={-1} className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-muted hover:bg-hover hover:text-fg focus-visible:bg-hover focus-visible:text-fg focus-visible:outline-none">
                  <HugeiconsIcon icon={icon} className="size-4 shrink-0" />
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
