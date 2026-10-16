import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';

const variants = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]',
  success: 'bg-success text-white hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]',
  secondary: 'bg-elevated text-fg border border-line hover:border-line-strong hover:bg-hover',
  ghost: 'text-muted hover:text-fg hover:bg-hover',
  danger: 'bg-elevated text-danger border border-line hover:border-danger/40 hover:bg-danger/10',
};

const sizes = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-md',
  md: 'h-8 px-3 text-[13px] gap-2 rounded-lg',
  icon: 'size-7 rounded-md justify-center',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...props }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center font-medium whitespace-nowrap transition-[background,border,filter,color] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
