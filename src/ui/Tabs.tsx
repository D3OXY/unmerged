import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { formatCount } from '@/lib/time';

/**
 * Sticky tab bar under the page header, bleeding to the page edges. It scrolls sideways on narrow
 * windows; the vertical axis is clipped so no scrollbar appears.
 */
export function TabBar({ children, trailing, className }: { children: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <nav
      className={cx(
        'sticky top-12 z-20 -mx-6 flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-line bg-bg/85 px-6 backdrop-blur-xl [scrollbar-width:none]',
        className,
      )}
    >
      {children}
      {trailing && <div className="ml-auto flex shrink-0 items-center gap-3 pl-4">{trailing}</div>}
    </nav>
  );
}

/** A tab linking to `href`; `peek` opens it in the side panel it sits in (see `data-peek` in the content script). */
export function Tab({ href, peek, active, icon, label, count }: { href: string; peek?: boolean; active?: boolean; icon: ReactNode; label: string; count?: number }) {
  return (
    <a
      href={href}
      data-peek={peek || undefined}
      className={cx('relative flex h-11 shrink-0 items-center gap-2 px-3 text-[13px] transition-colors [&_svg]:size-3.5', active ? 'font-medium text-fg' : 'text-muted hover:text-fg')}
    >
      {icon}
      {label}
      {count !== undefined && <span className="rounded-full bg-elevated px-1.5 text-[11px] text-muted tabular-nums">{formatCount(count)}</span>}
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
    </a>
  );
}
