import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Sidebar, type NavSection } from './Sidebar';

/**
 * Linear-style frame shared by every Unmerged page: sticky sidebar + scrolling content, and an `aside` on the
 * right (a list's side panel). The content is a size container, so pages lay out by the room they get.
 */
export function Shell({ children, active, aside }: { children: ReactNode; active?: NavSection; aside?: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} />
      <main className="@container min-w-0 flex-1">{children}</main>
      {aside}
    </div>
  );
}

export type Crumb = { label: ReactNode; href?: string };

/** Sticky top bar with breadcrumbs and page actions. */
export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-line bg-bg/80 px-6 backdrop-blur-xl">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1 text-[13px]">
          {i > 0 && <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 shrink-0 text-subtle" />}
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
