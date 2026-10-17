import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '@/lib/cx';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** The focused element, looking through shadow roots (ours reports only its host to `document`). */
function deepActiveElement() {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element instanceof HTMLElement ? element : null;
}

/** Keeps Tab and Shift+Tab cycling through the focusable elements inside `panel`. */
function trapTab(event: KeyboardEvent, panel: HTMLElement) {
  const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = focusable[0];
  const last = focusable.at(-1);
  const active = deepActiveElement();
  if (!first || !last) event.preventDefault();
  else if (event.shiftKey && (active === first || active === panel)) (event.preventDefault(), last.focus());
  else if (!event.shiftKey && active === last) (event.preventDefault(), first.focus());
}

/**
 * A dialog over the page; closes on Escape or a pointerdown on the backdrop. `className` styles the backdrop,
 * `panelClassName` the dialog itself. `Modal` is the usual card; the media viewer draws its own.
 *
 * Keys pressed in our shadow root never reach `window` (the root stops them, see `isolateEvents`), and
 * keys pressed elsewhere are swallowed by `installKeyboard`. So the panel takes focus when it opens and
 * listens for Escape itself. Tab stays inside the panel, and focus goes back to whatever had it before
 * once the panel closes.
 */
export function Overlay({
  label,
  onClose,
  className,
  panelClassName,
  children,
}: {
  label: string;
  onClose: () => void;
  className: string;
  panelClassName: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Read during the first render: by the first effect, an autoFocus field inside has already taken focus.
  const [opener] = useState(deepActiveElement);

  useEffect(() => {
    // Leave focus alone if a field inside already took it with autoFocus.
    if (!panel.current?.matches(':focus-within')) panel.current?.focus();
    // A command that navigated may have removed the opener; then there's nothing to go back to.
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <div className={cx('fixed inset-0 z-50 flex justify-center', className)} onPointerDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal
        aria-label={label}
        tabIndex={-1}
        className={cx('outline-none', panelClassName)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'Tab') trapTab(e, e.currentTarget);
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A centered card over a dimmed page (see `Overlay`). `className` sets its width. */
export function Modal({ label, onClose, className, children }: { label: string; onClose: () => void; className: string; children: ReactNode }) {
  return (
    <Overlay
      label={label}
      onClose={onClose}
      className="items-start overflow-y-auto bg-black/40 px-4 py-[10vh] backdrop-blur-[2px]"
      panelClassName={cx('max-w-full animate-pop overflow-hidden rounded-2xl border border-line-strong bg-elevated shadow-2xl shadow-black/50', className)}
    >
      {children}
    </Overlay>
  );
}
