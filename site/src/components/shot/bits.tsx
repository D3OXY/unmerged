import type { ReactNode } from 'react';

// The extension's primitives (src/ui), with the same classes, minus behavior: the shot is a picture.

/** Joins truthy class names. */
export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const AVATAR_TONES: Record<string, string> = {
  d3oxy: 'from-[#7170ff] to-[#3e306d]',
  holdout: 'from-[#ffcdac] to-[#bd715a]',
  tanstack: 'from-[#f2c94c] to-[#a3741a]',
  pierrecomputer: 'from-[#4ea7fc] to-[#1d4f8a]',
  'wxt-dev': 'from-[#4cb782] to-[#22664a]',
};

/** The extension's Avatar box, with initials on a gradient in place of GitHub's image so the shot makes no requests. */
export function Avatar({ name, size = 20, square, className }: { name: string; size?: number; square?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center bg-linear-to-br leading-none font-semibold text-white uppercase ring-1 ring-line',
        AVATAR_TONES[name] ?? 'from-subtle to-elevated',
        square ? 'rounded-md' : 'rounded-full',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {name[0]}
    </span>
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

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-line bg-panel', className)}>{children}</div>;
}

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]',
  success: 'bg-success text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]',
  secondary: 'bg-elevated text-fg border border-line',
  ghost: 'text-muted',
};

const BUTTON_SIZES = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-md',
  md: 'h-8 px-3 text-[13px] gap-2 rounded-lg',
  icon: 'size-7 rounded-md justify-center',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  className,
  children,
}: {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center font-medium whitespace-nowrap',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        disabled && 'opacity-50',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** GitHub-rendered markdown: the extension's `.u-markdown` paragraph type. */
export function Markdown({ children }: { children: ReactNode }) {
  return <div className="text-[14px] leading-[1.65] [overflow-wrap:anywhere] [&_code]:rounded-[5px] [&_code]:border [&_code]:border-line [&_code]:bg-elevated [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:font-mono [&_code]:text-[0.85em]">{children}</div>;
}
