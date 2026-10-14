import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export function Avatar({ src, size = 20, className, square }: { src?: string | null; size?: number; className?: string; square?: boolean }) {
  return (
    <img
      src={src ? `${src}${src.includes('?') ? '&' : '?'}s=${size * 2}` : undefined}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      alt=""
      className={cx('shrink-0 bg-elevated object-cover ring-1 ring-line', square ? 'rounded-md' : 'rounded-full', className)}
    />
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-elevated px-1 font-sans text-[10.5px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Pill({ children, className, color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span
      className={cx('inline-flex h-5 items-center gap-1 rounded-full border border-line px-2 text-[11px] font-medium text-muted', className)}
      style={color ? { borderColor: `#${color}55`, color: `color-mix(in srgb, #${color} 70%, var(--u-fg))`, background: `#${color}18` } : undefined}
    >
      {color && <span className="size-1.5 rounded-full" style={{ background: `#${color}` }} />}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-shimmer rounded-md bg-elevated', className)} />;
}

export function SectionHeader({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex h-8 items-center gap-2 px-1">
      <h2 className="text-[12px] font-medium text-muted">{title}</h2>
      {count !== undefined && <span className="text-[12px] text-subtle tabular-nums">{count}</span>}
      <div className="ml-auto">{action}</div>
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-line bg-panel', className)}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-6 text-center text-[12.5px] text-subtle">{children}</div>;
}

export function LanguageDot({ color }: { color: string | null }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: color ?? 'var(--u-subtle)' }} />;
}

/** GitHub-rendered (already sanitized) HTML. */
export function Markdown({ html, className }: { html: string; className?: string }) {
  return <div className={cx('u-markdown', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
