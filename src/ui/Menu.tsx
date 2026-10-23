import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { useDismiss } from './useDismiss';

/** `count` shows at the end of the row, e.g. how many items the option matches. */
export type MenuOption<T extends string> = { value: T; label: string; hint?: string; count?: number };

type Placement = { container: Element; top: number; left?: number; right?: number };

const GAP = 6;

/**
 * Small popover select. The panel is portaled to the app root with fixed positioning, so clipping
 * parents (overflow-hidden cards, scrolling sidebars, blurred headers) can't cut it off. It sits under
 * its trigger, flips above when there's no room, and follows the trigger while anything scrolls.
 * An array `value` makes it multi-select (picks toggle; the menu stays open). `header` sits above the
 * options, e.g. a search field.
 *
 * Opening focuses the header's input if there is one, else the checked option; ↑/↓, Home and End move
 * between options. Choosing one (in single-select), Escape or Tab closes the menu and puts focus back on
 * the trigger.
 */
export function Menu<T extends string>({
  value,
  options,
  onChange,
  trigger,
  header,
  align = 'right',
}: {
  value: T | T[];
  options: MenuOption<T>[];
  onChange: (value: T) => void;
  trigger: (open: () => void) => ReactNode;
  header?: ReactNode;
  align?: 'left' | 'right';
}) {
  const multiple = Array.isArray(value);
  const isSelected = (option: T) => (multiple ? value.includes(option) : option === value);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismiss([triggerRef, panelRef], open, useCallback(() => setOpen(false), []));

  const close = () => {
    setOpen(false);
    triggerRef.current?.querySelector<HTMLElement>('button, a[href], [tabindex]')?.focus();
  };

  // The panel moves into a portal once placed, so focus it then (once, not on every scroll).
  const placed = placement !== null;
  useEffect(() => {
    const panel = panelRef.current;
    if (!placed || !panel) return;
    // One query per kind: a selector list would return whichever comes first in the panel.
    const first = (selector: string) => panel.querySelector<HTMLElement>(selector);
    (first('input') ?? first('[aria-checked="true"]') ?? first('[role^="menuitem"]'))?.focus();
  }, [placed]);

  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const index = items.findIndex((item) => item === e.target);
    const moves: Record<string, HTMLElement | undefined> = { ArrowDown: items[(index + 1) % items.length], ArrowUp: items.at(index - 1), Home: items[0], End: items.at(-1) };
    const target = moves[e.key];
    if (target) (e.preventDefault(), target.focus());
    else if (e.key === 'Escape' || e.key === 'Tab') (e.preventDefault(), close());
  };

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
      onKeyDown={onKeyDown}
      style={placement ? { top: placement.top, left: placement.left, right: placement.right } : { visibility: 'hidden' }}
      className="fixed z-[60] max-h-80 w-64 animate-pop overflow-y-auto rounded-xl border border-line-strong bg-elevated p-1 shadow-2xl shadow-black/30"
    >
      {header}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role={multiple ? 'menuitemcheckbox' : 'menuitemradio'}
          aria-checked={isSelected(option.value)}
          tabIndex={-1}
          onClick={() => {
            onChange(option.value);
            if (!multiple) close();
          }}
          className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-hover"
        >
          <HugeiconsIcon icon={Tick02Icon} className={cx('mt-0.5 size-3.5 shrink-0', isSelected(option.value) ? 'text-accent' : 'invisible')} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium">{option.label}</span>
            {option.hint && <span className="block text-[12px] text-muted">{option.hint}</span>}
          </span>
          {option.count !== undefined && <span className="mt-px text-[12px] text-subtle tabular-nums">{option.count}</span>}
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
