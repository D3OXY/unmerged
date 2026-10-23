import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon, GithubIcon } from '@hugeicons/core-free-icons';
import { Logo } from './ui';
import { useBrowser, useInstallHref } from '../install';
import { REPO_URL } from '../site';

/** Links to the home page's sections, so they work from every page. `wide` links show only from sm up. */
const NAV_LINKS = [
  { href: '/#pages', label: 'Pages' },
  { href: '/#speed', label: 'Speed', wide: true },
  { href: '/privacy', label: 'Privacy', wide: true },
  { href: '/#faq', label: 'FAQ' },
];

/**
 * Floating liquid-glass bar on every page; it narrows and shortens while scrolling down and expands again on the way
 * up. Install is its one filled button, except on phones, which can't install.
 */
export function Nav() {
  const [compact, setCompact] = useCompactOnScroll();
  const installHref = useInstallHref();
  const phone = useBrowser() === 'phone';
  return (
    <header
      data-compact={compact || undefined}
      // Keyboard focus always gets the full bar.
      onFocus={() => setCompact(false)}
      className="group pointer-events-none sticky top-0 z-50 flex h-16 justify-center px-3 pt-3"
    >
      <div className="glass pointer-events-auto flex h-[52px] w-[min(1120px,100%)] items-center rounded-full pr-2 pl-3.5 transition-[width,height,padding] duration-500 ease-spring group-data-compact:h-11 group-data-compact:w-[min(560px,100%)] group-data-compact:pr-1.5 group-data-compact:pl-3 sm:pl-5">
        <a href="/" aria-label="Unmerged" className="flex shrink-0 items-center gap-2">
          <Logo size={24} />
          <span className="hidden text-[15px] font-semibold tracking-tight min-[400px]:inline">Unmerged</span>
        </a>
        <nav className="ml-auto flex items-center text-[13px] text-muted sm:text-[13.5px]">
          {NAV_LINKS.map(({ href, label, wide }) => (
            <a
              key={href}
              href={href}
              className={`rounded-full px-2 py-1.5 transition-colors hover:bg-white/[0.06] hover:text-fg sm:px-3 ${wide ? 'hidden sm:block' : ''}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          href={REPO_URL}
          aria-label="GitHub"
          className="ml-1 flex h-9 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 text-[13px] font-medium transition-[background-color,height,padding] duration-500 ease-spring hover:bg-white/[0.12] group-data-compact:h-8 group-data-compact:px-[7px] sm:ml-2"
        >
          <HugeiconsIcon icon={GithubIcon} className="size-4 shrink-0" />
          {/* The label folds away in the compact bar and on phones; the icon carries it there. */}
          <span className="hidden max-w-16 overflow-hidden pl-2 whitespace-nowrap opacity-100 transition-[max-width,padding,opacity] duration-500 ease-spring group-data-compact:max-w-0 group-data-compact:pl-0 group-data-compact:opacity-0 sm:inline">
            GitHub
          </span>
        </a>
        {!phone && (
          <a
            href={installHref}
            className="ml-1.5 hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-fg pr-3.5 pl-3 text-[13px] font-medium text-bg transition-[background-color,height] duration-500 ease-spring hover:bg-white group-data-compact:h-8 sm:flex"
          >
            <HugeiconsIcon icon={Download04Icon} className="size-4" />
            Install
          </a>
        )}
      </div>
    </header>
  );
}

/** Pixels of scrolling in one direction before the nav changes size, so jitter and trackpad noise don't flip it. */
const SCROLL_SLACK = 6;

/**
 * True while the reader is scrolling down past the top of the page; a slight scroll back up, or reaching the
 * top, clears it. Small moves accumulate against the last position that changed the state.
 */
function useCompactOnScroll() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let anchor = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Clamped so iOS rubber-banding past either end doesn't read as a direction change.
      const y = Math.min(Math.max(window.scrollY, 0), document.documentElement.scrollHeight - window.innerHeight);
      if (y < 24) setCompact(false);
      else if (y - anchor > SCROLL_SLACK) setCompact(true);
      else if (anchor - y > SCROLL_SLACK) setCompact(false);
      else return;
      anchor = y;
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return [compact, setCompact] as const;
}
