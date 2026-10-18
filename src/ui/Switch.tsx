import { useLayoutEffect, useRef } from 'react';
import { cx } from '@/lib/cx';

// Thumb x in px on the 40×20 track: a 2px inset on each side of the 16px thumb.
const OFF = 2;
const ON = 22;
// The spring of Bencho's Liquid toggle (bencho.dev/blocks/liq-toggle).
const STIFFNESS = 170;
const DAMPING = 21.5;
const MASS = 0.9;

/**
 * The on/off mark of a switch. Put it inside the element that has `role="switch"` and the `group` class.
 * The thumb is a liquid drop: a spring moves it, and it gets longer and flatter as it moves faster.
 * The spring runs on animation frames only while the thumb moves, and it changes only `transform`.
 */
export function Switch({ on }: { on: boolean }) {
  const thumb = useRef<HTMLSpanElement>(null);
  const motion = useRef({ x: on ? ON : OFF, v: 0 });

  // Layout effect, so the first paint has the thumb at its place.
  useLayoutEffect(() => {
    const el = thumb.current!;
    const m = motion.current;
    const target = on ? ON : OFF;
    const paint = () => {
      // At most 14% longer, at about the top speed of the spring.
      const stretch = 1 + Math.min(0.144, Math.abs(m.v) / 720);
      el.style.transform = `translateX(${m.x}px) scale(${stretch}, ${1 / stretch})`;
    };
    if ((m.x === target && m.v === 0) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      m.x = target;
      m.v = 0;
      paint();
      return;
    }

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // 1ms steps keep the spring stable on any refresh rate; a long pause counts as 64ms.
      for (let ms = Math.min(64, now - last); ms > 0; ms--) {
        m.v += ((STIFFNESS * (target - m.x) - DAMPING * m.v) / MASS) * 0.001;
        m.x += m.v * 0.001;
      }
      last = now;
      if (Math.abs(target - m.x) < 0.05 && Math.abs(m.v) < 1) {
        m.x = target;
        m.v = 0;
      } else frame = requestAnimationFrame(tick);
      paint();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on]);

  return (
    <span className={cx('relative h-5 w-10 shrink-0 rounded-full transition-colors duration-[420ms]', on ? 'bg-accent' : 'bg-line')}>
      <span
        ref={thumb}
        className={cx(
          'absolute top-0.5 left-0 size-4 rounded-full [transition:background-color_420ms,scale_200ms_ease-out] group-hover:scale-[1.035]',
          on ? 'bg-accent-fg' : 'bg-[color-mix(in_srgb,var(--color-fg)_19%,var(--color-line))]',
        )}
      />
    </span>
  );
}
