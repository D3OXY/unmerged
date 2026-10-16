import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * A centered panel over a dimmed page; closes on Escape or a pointerdown on the backdrop.
 *
 * Keys pressed in our shadow root never reach `window` (the root stops them, see `isolateEvents`), and
 * keys pressed elsewhere are swallowed by `installKeyboard`. So the panel takes focus when it opens and
 * listens for Escape itself. `className` sets its width.
 */
export function Modal({ label, onClose, className, children }: { label: string; onClose: () => void; className: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Leave focus alone if a field inside already took it with autoFocus.
    if (!panel.current?.matches(':focus-within')) panel.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[10vh] backdrop-blur-[2px]" onPointerDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal
        aria-label={label}
        tabIndex={-1}
        className={cx('max-w-full animate-pop overflow-hidden rounded-2xl border border-line-strong bg-elevated shadow-2xl shadow-black/50 outline-none', className)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        {children}
      </div>
    </div>
  );
}
