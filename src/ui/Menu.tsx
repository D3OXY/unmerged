import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cx } from '@/lib/cx';
import { useDismiss } from './useDismiss';

export type MenuOption<T extends string> = { value: T; label: string; hint?: string };

type Placement = { container: Element; top: number; left?: number; right?: number };

const GAP = 6;

/**
 * Small popover select. The panel is portaled to the app root with fixed positioning, so clipping
 * parents (overflow-hidden cards, scrolling sidebars, blurred headers) can't cut it off. It sits under
 * its trigger, flips above when there's no room, and follows the trigger while anything scrolls.
 */
export function Menu<T extends string>({
  value,
  options,
  onChange,
  trigger,
  align = 'right',
}: {
  value: T;
  options: MenuOption<T>[];
  onChange: (value: T) => void;
  trigger: (open: () => void) => ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismiss([triggerRef, panelRef], open, useCallback(() => setOpen(false), []));

  useLayoutEffect(() => {
    if (!open) return setPlacement(null);
    const place = () => {
      const anchor = triggerRef.current!;
      const rect = anchor.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 0;
      const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - GAP;
      const top = fitsBelow || rect.top < height + GAP * 2 ? rect.bottom + GAP : rect.top - GAP - height;
      const viewportWidth = document.documentElement.clientWidth;
      setPlacement({
        container: anchor.closest('.u-root') ?? anchor,
        top,
        ...(align === 'right' ? { right: viewportWidth - rect.right } : { left: rect.left }),
      });
    };
    place();
    // Scrolls inside our shadow root (e.g. the PR sidebar) aren't composed, so they never reach window.
    const root = triggerRef.current!.getRootNode();
    root.addEventListener('scroll', place, true);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      root.removeEventListener('scroll', place, true);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align]);

  // First render measures the panel invisibly at the trigger; the layout effect then places it before paint.
  const panel = open && (
    <div
      ref={panelRef}
      role="menu"
      style={placement ? { top: placement.top, left: placement.left, right: placement.right } : { visibility: 'hidden' }}
      className="fixed z-[60] max-h-80 w-64 animate-pop overflow-y-auto rounded-xl border border-line-strong bg-elevated p-1 shadow-2xl shadow-black/30"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.value === value}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}
          className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-hover"
        >
          <Check className={cx('mt-0.5 size-3.5 shrink-0', option.value === value ? 'text-accent' : 'invisible')} />
          <span>
            <span className="block text-[13px] font-medium">{option.label}</span>
            {option.hint && <span className="block text-[12px] text-muted">{option.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div ref={triggerRef} className="relative">
      {trigger(() => setOpen((o) => !o))}
      {panel && (placement ? createPortal(panel, placement.container) : panel)}
    </div>
  );
}
