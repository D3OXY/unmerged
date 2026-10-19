import { useRef, useState } from 'react';

const urls = import.meta.glob<string>('../assets/shot-*.webp', { query: '?url', import: 'default', eager: true });
const src = (name: string, width: number) => urls[`../assets/shot-${name}-${width}.webp`];

/** The slides, in order. Each has a 1120px and a 2000px WebP in site/src/assets, named shot-<name>-<width>.webp. */
const SLIDES = [
  { name: 'repo', label: 'Repository', alt: 'A repository page in Unmerged, split diagonally between dark and light mode' },
  { name: 'pr', label: 'Pull request', alt: 'A pull request conversation in Unmerged' },
  { name: 'files', label: 'Files changed', alt: "A pull request's changed files side by side in Unmerged" },
  { name: 'issues', label: 'Issues', alt: 'An issue list with one issue open in a side panel, in Unmerged' },
  { name: 'palette', label: 'Command palette', alt: "The ⌘K command palette with a pull request's actions, in Unmerged" },
  { name: 'org', label: 'Organization', alt: "An organization's page in Unmerged" },
];

/**
 * Screenshots of Unmerged's pages in a horizontal strip that snaps to each one: swipe or scroll it, or pick a
 * page below it. Only the first image loads with the page; the others load as they come into view.
 */
export function Screenshots() {
  const strip = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const show = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: instant ? 'auto' : 'smooth' });
  };

  return (
    <div>
      <div
        ref={strip}
        tabIndex={0}
        aria-label="Screenshots"
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((slide, i) => (
          <img
            key={slide.name}
            src={src(slide.name, 2000)}
            srcSet={`${src(slide.name, 1120)} 1120w, ${src(slide.name, 2000)} 2000w`}
            sizes="(min-width: 1120px) 1072px, 100vw"
            width={2000}
            height={1307}
            alt={slide.alt}
            loading={i ? 'lazy' : 'eager'}
            fetchPriority={i ? 'auto' : 'high'}
            draggable={false}
            className="h-auto w-full shrink-0 snap-center"
          />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-1.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.name}
            type="button"
            onClick={() => show(i)}
            aria-current={i === current ? 'true' : undefined}
            className="h-8 cursor-pointer rounded-full px-3.5 text-[13px] text-muted transition-colors hover:text-fg aria-[current=true]:bg-white/[0.08] aria-[current=true]:text-fg"
          >
            {slide.label}
          </button>
        ))}
      </div>
    </div>
  );
}
