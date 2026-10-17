import type { ReactNode } from 'react';
import holdout from '../../../src/assets/logo/holdout.svg?url';
import holdoutSmall from '../../../src/assets/logo/holdout-16.svg?url';

/** Holdout, the Unmerged mascot, from the extension's own files. At 28px and below it uses the 16px-grid version. */
export function Logo({ size = 22 }: { size?: number }) {
  return <img src={size <= 28 ? holdoutSmall : holdout} width={size} height={size} alt="" className="shrink-0" />;
}

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-elevated px-1 font-sans text-[10.5px] font-medium text-muted ${className}`}>
      {children}
    </kbd>
  );
}
