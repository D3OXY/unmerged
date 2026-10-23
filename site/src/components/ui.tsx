import type { ReactNode } from 'react';
import holdout from '../../../src/assets/logo/holdout.svg?url';
import holdoutSmall from '../../../src/assets/logo/holdout-16.svg?url';

/** Holdout, the Unmerged mascot, from the extension's own files. At 28px and below it uses the 16px-grid version. */
export function Logo({ size = 22 }: { size?: number }) {
  return <img src={size <= 28 ? holdoutSmall : holdout} width={size} height={size} alt="" className="shrink-0" />;
}

/** Pill links: a cream one for the main action, a quiet one beside it, and an outlined one for actions that aren't installing. */
export const BUTTON = {
  primary:
    'flex h-11 items-center justify-center gap-2 rounded-full bg-fg px-5 text-[14.5px] font-medium text-bg transition-[background-color,scale] duration-150 hover:bg-white active:scale-[0.97]',
  secondary:
    'flex h-11 items-center justify-center gap-2 rounded-full bg-elevated px-5 text-[14.5px] font-medium transition-[filter,scale] duration-150 hover:brightness-125 active:scale-[0.97]',
  outline:
    'flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong px-5 text-[14.5px] font-medium transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.97]',
};

/** The small pill that says Unmerged is in alpha, at the start of a line of text that wraps around it. */
export function AlphaPill() {
  return (
    <span className="mr-2 inline-flex h-5 items-center align-[1px] rounded-full border border-accent/40 bg-accent/12 px-2 text-[11.5px] font-medium text-[#a9a8ff]">
      Alpha
    </span>
  );
}

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-elevated px-1 font-sans text-[10.5px] font-medium text-muted ${className}`}>
      {children}
    </kbd>
  );
}
