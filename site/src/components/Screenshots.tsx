import { useRef, useState, type PointerEvent, type RefObject } from 'react';

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
 * page below it. Only the first image loads with the page; the others load as they come into view. With a
 * mouse, a glass bubble follows the pointer and magnifies the screenshot under it.
 */
export function Screenshots() {
  const strip = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const lens = useGlassBubble(strip);

  const show = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: instant ? 'auto' : 'smooth' });
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg">
        <div
          ref={strip}
          tabIndex={0}
          aria-label="Screenshots"
          onScroll={(e) => {
            setCurrent(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth));
            lens.follow();
          }}
          onPointerMove={lens.move}
          onPointerLeave={lens.hide}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [@media(pointer:fine)]:cursor-none"
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
        {lens.element}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.name}
            type="button"
            onClick={() => show(i)}
            aria-current={i === current ? 'true' : undefined}
            className="h-8 cursor-pointer rounded-full px-3.5 text-[13px] text-muted transition-colors hover:text-fg aria-[current=true]:bg-elevated aria-[current=true]:text-fg"
          >
            {slide.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The bubble's diameter, in px. */
const LENS = 200;
/** Content drawn past the bubble's rim on each side, so the refraction there has pixels to sample. */
const PAD = 28;
const VIEW = LENS + 2 * PAD;
/** How much larger the screenshot looks through the glass. */
const ZOOM = 1.9;
/** The strongest refraction offset at the rim, in px (feDisplacementMap's scale), and the color split around it. */
const BEND = 44;
const FRINGE = 5;

/**
 * A glass bubble over `strip` that follows a mouse or pen. It shows the slide under the pointer, magnified, with
 * the rim bending outward and a thin color fringe. Moves only touch two style properties: no React updates.
 */
function useGlassBubble(strip: RefObject<HTMLDivElement | null>) {
  const lens = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const point = useRef<{ x: number; y: number } | null>(null);
  // The displacement map, built on the first mouse move ('' where a canvas can't draw it). Touch never builds it.
  const [map, setMap] = useState<string>();

  const follow = () => {
    const el = strip.current;
    const at = point.current;
    if (!el || !at || !lens.current || !view.current) return;
    const width = el.clientWidth;
    const index = Math.min(SLIDES.length - 1, Math.floor((el.scrollLeft + at.x) / width));
    const image = el.querySelectorAll('img')[index];
    if (!image) return;
    const x = el.scrollLeft + at.x - index * width;
    lens.current.style.transform = `translate3d(${at.x - LENS / 2}px, ${at.y - LENS / 2}px, 0)`;
    const style = view.current.style;
    const url = `url("${image.currentSrc}")`;
    if (style.backgroundImage !== url) style.backgroundImage = url;
    style.backgroundSize = `${width * ZOOM}px ${el.clientHeight * ZOOM}px`;
    style.backgroundPosition = `${VIEW / 2 - x * ZOOM}px ${VIEW / 2 - at.y * ZOOM}px`;
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (map === undefined) setMap(bulgeMap(VIEW));
    if (!map || !lens.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    point.current = { x: e.clientX - box.left, y: e.clientY - box.top };
    lens.current.style.opacity = '1';
    follow();
  };

  const hide = () => {
    point.current = null;
    if (lens.current) lens.current.style.opacity = '0';
  };

  const element = map && (
    <>
      <svg aria-hidden className="absolute size-0">
        <filter id="glass-bubble" x="0" y="0" width={VIEW} height={VIEW} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feImage href={map} x="0" y="0" width={VIEW} height={VIEW} preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={BEND + FRINGE} xChannelSelector="R" yChannelSelector="G" result="red" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={BEND} xChannelSelector="R" yChannelSelector="G" result="green" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={BEND - FRINGE} xChannelSelector="R" yChannelSelector="G" result="blue" />
          <feColorMatrix in="red" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feColorMatrix in="green" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="blue" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b" mode="screen" />
        </filter>
      </svg>
      <div
        ref={lens}
        aria-hidden
        style={{ width: LENS, height: LENS, opacity: 0 }}
        className="pointer-events-none absolute top-0 left-0 overflow-hidden rounded-full shadow-[0_18px_40px_-12px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.35)] transition-opacity duration-150"
      >
        <div
          ref={view}
          style={{ left: -PAD, top: -PAD, width: VIEW, height: VIEW, filter: 'url(#glass-bubble)' }}
          className="absolute bg-no-repeat"
        />
        {/* The glass itself: a soft highlight up top and a darker, lit rim. */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.2),transparent_30%)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25),inset_0_-8px_20px_rgb(0_0_0/0.25),inset_0_6px_14px_rgb(255_255_255/0.14)]" />
      </div>
    </>
  );

  return { element, move, hide, follow };
}

/**
 * The displacement map for a ball of glass, as a data URL: red and green hold each pixel's x and y offset, which
 * grows with the square of its distance from the center, so the picture bends outward toward the rim.
 */
function bulgeMap(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const pixels = context.createImageData(size, size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - r) / r;
      const dy = (y + 0.5 - r) / r;
      const pull = Math.min(1, dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      pixels.data[i] = 128 + dx * pull * 127;
      pixels.data[i + 1] = 128 + dy * pull * 127;
      pixels.data[i + 2] = 128;
      pixels.data[i + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}
