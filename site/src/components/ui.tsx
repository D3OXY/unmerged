import type { ReactNode } from 'react';
import holdout from '../../../src/assets/logo/holdout.svg?url';
import holdoutSmall from '../../../src/assets/logo/holdout-16.svg?url';

/** Holdout, the Unmerged mascot, from the extension's own files. At 28px and below it uses the 16px-grid version. */
export function Logo({ size = 22 }: { size?: number }) {
  return <img src={size <= 28 ? holdoutSmall : holdout} width={size} height={size} alt="" className="shrink-0" />;
}

/** Pill links: a cream one for the main action, a quiet one beside it. */
export const BUTTON = {
  primary:
    'flex h-11 items-center justify-center gap-2 rounded-full bg-fg px-5 text-[14.5px] font-medium text-bg transition-[background-color,scale] duration-150 hover:bg-white active:scale-[0.97]',
  secondary:
    'flex h-11 items-center justify-center gap-2 rounded-full bg-elevated px-5 text-[14.5px] font-medium transition-[filter,scale] duration-150 hover:brightness-125 active:scale-[0.97]',
};

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-elevated px-1 font-sans text-[10.5px] font-medium text-muted ${className}`}>
      {children}
    </kbd>
  );
}
