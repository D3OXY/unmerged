import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import results from '../../../bench/results/latest.json';

type Scenario = (typeof results.scenarios)[number];
type Visit = 'cold' | 'warm';
type Side = Scenario['github'][Visit];

const VISITS: { id: Visit; label: string }[] = [
  { id: 'cold', label: 'First visit' },
  { id: 'warm', label: 'Repeat visit' },
];

/**
 * Page loads, then clicks inside a page (scenarios with `from`), timed from the click. Results with page loads
 * only make one group, shown without its title.
 */
const LOADS = results.scenarios.filter((s) => !('from' in s));
const GROUPS = [
  { title: 'Page loads', note: 'from the start of the navigation', scenarios: LOADS },
  { title: 'Clicks inside a page', note: 'from the click, after a 150 ms hover on the link', scenarios: results.scenarios.filter((s) => 'from' in s) },
].filter((g) => g.scenarios.length > 0);

/** The slowest time in the results: every lane shares this scale, so a second is the same width everywhere. */
const LONGEST = Math.max(...results.scenarios.flatMap((s) => VISITS.flatMap((v) => [s.github[v.id].ms ?? 0, s.unmerged[v.id].ms ?? 0])));
/** Seconds marked on each axis, and as faint lines across the lanes. */
const TICKS = Array.from({ length: Math.floor(LONGEST / 2000) + 1 }, (_, i) => i * 2);
/** Room after the scale for the time label of a bar that ends near it. */
const LABEL_ROOM = 'mr-[4.5rem]';
/** One block in the data chart. */
const BLOCK = 100_000;
/** A blocking time worth a line under the lanes. */
const NOTABLE_BLOCKING = 100;

/**
 * The benchmark in bench/ (results/latest.json), played back at real speed: when it scrolls into view a clock
 * starts, and each page's GitHub and Unmerged lanes grow until the moment that side showed the content, for
 * first and repeat visits side by side. Below, what each page downloaded, as blocks. Elapsed time is one CSS
 * variable (`--t`, ms) that the lanes read, so playing touches no React state. With reduced motion, and before
 * scripts run, it shows the end state.
 */
export function Benchmark() {
  const panel = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  const show = (ms: number) => {
    panel.current?.style.setProperty('--t', String(ms));
    if (clock.current) clock.current.textContent = `${(ms / 1000).toFixed(2)} s`;
  };

  const play = () => {
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(now - start, LONGEST);
      show(t);
      if (t < LONGEST) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const el = panel.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    show(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        play();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
    // Once: `show` and `play` only touch refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div ref={panel} style={{ '--t': LONGEST } as CSSProperties} className="overflow-hidden rounded-2xl border border-line bg-panel/60">
        <div className="flex items-center gap-5 border-b border-line px-6 py-4">
          <span ref={clock} aria-hidden className="w-[5.5rem] font-mono text-[22px] font-medium tracking-tight tabular-nums">
            {(LONGEST / 1000).toFixed(2)} s
          </span>
          <span className="hidden text-[12.5px] text-subtle sm:block">Played back at the measured speed</span>
          <span className="ml-auto flex items-center gap-4 text-[12.5px] text-muted">
            <Key className="bg-white/30">GitHub</Key>
            <Key className="bg-accent">Unmerged</Key>
          </span>
          <button
            type="button"
            onClick={play}
            className="h-7 cursor-pointer rounded-full border border-line px-3 text-[12.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
          >
            Replay
          </button>
        </div>
        <Grid className="hidden border-b border-line py-3 md:grid">
          <span />
          {VISITS.map((v) => (
            <Axis key={v.id} label={v.label} />
          ))}
        </Grid>
        <Groups
          row={(s) => (
            <Grid key={s.id} as="li" className="py-5">
              <PageLabel scenario={s} />
              {VISITS.map((v) => (
                <div key={v.id} className="space-y-2">
                  <p className="text-[11.5px] text-subtle md:hidden">{v.label}</p>
                  <Lane side={s.github[v.id]} className="bg-white/30" name={`GitHub, ${v.label.toLowerCase()}`} />
                  <Lane side={s.unmerged[v.id]} className="bg-accent" name={`Unmerged, ${v.label.toLowerCase()}`} />
                  <Timeouts github={s.github[v.id]} unmerged={s.unmerged[v.id]} />
                  <Blocking github={s.github[v.id]} unmerged={s.unmerged[v.id]} />
                </div>
              ))}
            </Grid>
          )}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-panel/60">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-6 py-4">
          <h3 className="text-[15px] font-medium">What each page downloaded</h3>
          <span className="flex items-center gap-1.5 text-[12.5px] text-subtle">
            <span className="size-[7px] rounded-[2px] bg-white/40" /> 100 KB over the network, compressed
          </span>
        </div>
        <Grid className="hidden border-b border-line py-3 md:grid">
          <span />
          {VISITS.map((v) => (
            <span key={v.id} className="text-[12px] text-muted">
              {v.label}
            </span>
          ))}
        </Grid>
        <Groups
          row={(s) => (
            <Grid key={s.id} as="li" className="py-5">
              <PageLabel scenario={s} />
              {VISITS.map((v) => (
                <div key={v.id} className="space-y-2">
                  <p className="text-[11.5px] text-subtle md:hidden">{v.label}</p>
                  <Blocks side={s.github[v.id]} className="bg-white/30" name="GitHub" />
                  <Blocks side={s.unmerged[v.id]} className="bg-accent" name="Unmerged" />
                </div>
              ))}
            </Grid>
          )}
        />
      </div>
    </div>
  );
}

/** Each group's rows, under the group's title when there is more than one group. */
function Groups({ row }: { row: (scenario: Scenario) => ReactNode }) {
  return GROUPS.map((g) => (
    <section key={g.title} className="border-line not-first:border-t">
      {GROUPS.length > 1 && (
        <p className="border-b border-line px-6 py-2.5 text-[12px] text-muted">
          {g.title} <span className="text-subtle">· {g.note}</span>
        </p>
      )}
      <ul className="divide-y divide-line">{g.scenarios.map(row)}</ul>
    </section>
  ));
}

/** Where the lanes and blocks line up: the page, then first and repeat visits. */
function Grid({ as: Tag = 'div', className, children }: { as?: 'div' | 'li'; className?: string; children: ReactNode }) {
  return <Tag className={`grid gap-x-8 gap-y-4 px-6 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] ${className ?? ''}`}>{children}</Tag>;
}

function PageLabel({ scenario }: { scenario: Scenario }) {
  return (
    <div>
      <a href={scenario.url} className="text-[14px] font-medium text-fg hover:underline hover:underline-offset-2">
        {scenario.label}
      </a>
      <p className="mt-0.5 text-[12.5px] leading-snug text-subtle">{scenario.detail}</p>
    </div>
  );
}

/** A visit's column title over its seconds, on the shared scale. */
function Axis({ label }: { label: string }) {
  return (
    <div>
      <span className="text-[12px] text-muted">{label}</span>
      <div className={`relative mt-1.5 h-3.5 font-mono text-[10.5px] text-subtle ${LABEL_ROOM}`}>
        {TICKS.map((s) => (
          <span key={s} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${at(s * 1000)}%` }}>
            {s} s
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * One side's lane: the bar grows with `--t` until this side's time, and its time fades in at the bar's end as the
 * bar arrives (playback stops on the slowest lane, so the fade can't wait for later). A side that never showed the
 * content runs to the end of the scale and fades out, with its label inside.
 */
function Lane({ side, className, name }: { side: Side; className: string; name: string }) {
  const ms = side.ms ?? LONGEST;
  const shown = side.ms !== null;
  return (
    <div role="img" aria-label={`${name}: ${time(side.ms)}`} className={`relative h-5 ${LABEL_ROOM}`}>
      <div className="absolute inset-0 rounded-full bg-white/[0.035]" />
      {TICKS.slice(1).map((s) => (
        <div key={s} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: `${at(s * 1000)}%` }} />
      ))}
      <div
        className={`absolute inset-y-0 left-0 origin-left rounded-full ${className} ${shown ? '' : 'rounded-r-none [mask-image:linear-gradient(to_right,black_45%,transparent)]'}`}
        style={{ width: `${at(ms)}%`, scale: `clamp(0, calc(var(--t) / ${ms}), 1) 1` }}
      />
      <span
        className={`absolute top-1/2 -translate-y-1/2 font-mono text-[12px] whitespace-nowrap ${shown ? 'pl-2.5 text-fg/90' : 'right-0 pr-2.5 text-muted'}`}
        style={{ left: shown ? `${at(ms)}%` : undefined, opacity: `clamp(0, calc((var(--t) - ${ms - 150}) / 150), 1)` }}
      >
        {time(side.ms)}
      </span>
    </div>
  );
}

/** A line under the lanes for each side that showed no content in some runs: the median hides how often. */
function Timeouts({ github, unmerged }: { github: Side; unmerged: Side }) {
  const sides = [
    ['GitHub', github],
    ['Unmerged', unmerged],
  ] as const;
  return sides.map(([name, side]) => {
    const missed = side.runs.filter((run) => run === null).length;
    if (!missed) return null;
    return (
      <p key={name} className="pt-1 text-[12px] text-subtle">
        {name}: no content within {TIMEOUT} in {missed} of {side.runs.length} runs
      </p>
    );
  });
}

/** A line under the lanes when either side kept the main thread busy long enough to notice. */
function Blocking({ github, unmerged }: { github: Side; unmerged: Side }) {
  if (Math.max(github.blockingMs, unmerged.blockingMs) < NOTABLE_BLOCKING) return null;
  return (
    <p className="pt-1 text-[12px] text-subtle">
      Main thread blocked: GitHub {github.blockingMs} ms, Unmerged {unmerged.blockingMs} ms
    </p>
  );
}

/** One side's download as blocks of 100 KB, with the size and the request count. */
function Blocks({ side, className, name }: { side: Side; className: string; name: string }) {
  const count = Math.max(1, Math.round(side.bytes / BLOCK));
  return (
    <div
      role="img"
      aria-label={`${name}: ${size(side.bytes)} in ${side.requests} requests${side.ms === null ? `, and ${time(null)}` : ''}`}
      className="flex items-start gap-3"
    >
      <div className="flex flex-1 flex-wrap gap-[3px] pt-[3px]">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`size-[7px] rounded-[2px] ${className}`} />
        ))}
      </div>
      <span className="w-[8.5rem] shrink-0 text-right font-mono text-[12px] text-muted">
        {size(side.bytes)} · {side.requests} req
        {side.ms === null && <span className="block text-[11px] text-subtle">no content</span>}
      </span>
    </div>
  );
}

function Key({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${className}`} />
      {children}
    </span>
  );
}

/** Where `ms` falls on the shared scale, in percent. */
const at = (ms: number) => (ms / LONGEST) * 100;
/** How long bench/run.ts waits for a page's content before it gives up. */
const TIMEOUT = '60 s';
const time = (ms: number | null) => (ms === null ? `no content in ${TIMEOUT}` : `${(ms / 1000).toFixed(2)} s`);
const size = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`);

/** How the results were measured, for the section's text. */
export const benchmarkSetup = { pages: LOADS.length, runs: results.runs, date: results.date, signedIn: results.signedIn };
