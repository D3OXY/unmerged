import { useEffect, useRef, useState, type CSSProperties } from 'react';
import results from '../../../bench/results/latest.json';

type Scenario = (typeof results.scenarios)[number];
type Visit = 'cold' | 'warm';
type Metric = 'time' | 'data';
type Side = Scenario['github' | 'unmerged'][Visit];

const VISITS: { id: Visit; label: string }[] = [
  { id: 'cold', label: 'First visit' },
  { id: 'warm', label: 'Repeat visit' },
];
const METRICS: { id: Metric; label: string }[] = [
  { id: 'time', label: 'Time' },
  { id: 'data', label: 'Data' },
];

/** Page loads, then clicks inside a page (scenarios with `from`), timed from the click. Each group has its own scale. */
const LOADS = results.scenarios.filter((s) => !('from' in s));
const GROUPS = [
  { title: 'Page loads', scenarios: LOADS },
  { title: 'Clicks inside a page', scenarios: results.scenarios.filter((s) => 'from' in s) },
].filter((g) => g.scenarios.length > 0);

/** How long bench/run.ts waits for a page's content before it gives up. */
const TIMEOUT_MS = 60_000;
const TIMEOUT = `${TIMEOUT_MS / 1000} s`;
/** A blocking time worth a line under the rows. */
const NOTABLE_BLOCKING = 100;
/** Columns of a row from md up: page, bars, Unmerged, GitHub, ratio. */
const COLUMNS = 'md:grid-cols-[196px_minmax(0,1fr)_64px_84px_74px]';

const value = (side: Side, metric: Metric) => (metric === 'time' ? side.ms : side.bytes);
/** Where playback stops for a visit: when the slowest side that showed its content did. */
const playbackEnd = (visit: Visit) =>
  Math.max(...results.scenarios.flatMap((s) => [s.github[visit].ms ?? 0, s.unmerged[visit].ms ?? 0]));

/**
 * The benchmark in bench/ (results/latest.json), one row per page with GitHub's bar above Unmerged's. With Time, it
 * plays back at real speed when it scrolls into view: a clock starts, each bar grows until the moment that side
 * showed the content, and the times at the right count up until then. With Data, the bars show what each side
 * downloaded. Elapsed time is one CSS variable (`--t`, ms) that the bars read, and the counters are written
 * directly, so playing touches no React state. With reduced motion, and before scripts run, it shows the end state.
 */
export function Benchmark() {
  const [visit, setVisit] = useState<Visit>('cold');
  const [metric, setMetric] = useState<Metric>('time');
  const panel = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  const seen = useRef(false);
  const end = playbackEnd(visit);

  /** Shows the moment `ms` of playback on the bars, the clock and the counters. */
  const show = (ms: number, counters: HTMLElement[]) => {
    panel.current?.style.setProperty('--t', String(ms));
    if (clock.current) clock.current.textContent = seconds(ms);
    for (const c of counters) c.textContent = ms >= Number(c.dataset.until) ? (c.dataset.final ?? '') : seconds(ms);
  };

  const play = () => {
    const counters = [...(panel.current?.querySelectorAll<HTMLElement>('[data-until]') ?? [])];
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(now - start, end);
      show(t, counters);
      if (t < end) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  // Plays once the panel scrolls into view, then again on each change of visit, and on the way back to Time.
  useEffect(() => {
    const el = panel.current;
    if (!el || metric === 'data' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (seen.current) {
      play();
      return () => cancelAnimationFrame(frame.current);
    }
    show(0, [...el.querySelectorAll<HTMLElement>('[data-until]')]);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        seen.current = true;
        play();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
    // `show` and `play` only touch refs, and `end` follows `visit`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, metric]);

  const average = geometricMean(
    LOADS.flatMap((s) => {
      const github = s.github[visit].ms;
      const unmerged = s.unmerged[visit].ms;
      return github === null || unmerged === null ? [] : [github / unmerged];
    }),
  );

  return (
    <div
      ref={panel}
      style={{ '--t': end } as CSSProperties}
      className="overflow-hidden rounded-lg bg-panel"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-6 py-4">
        {metric === 'time' ? (
          <>
            <span ref={clock} aria-hidden className="w-[5.5rem] font-mono text-[22px] font-medium tracking-tight whitespace-nowrap tabular-nums">
              {seconds(end)}
            </span>
            <span className="text-[13px] text-muted">
              Pages show <span className="font-medium text-fg">{times(average)}× sooner</span> on average
            </span>
          </>
        ) : (
          <span className="py-1 text-[13px] text-muted">What crossed the network, compressed</span>
        )}
        <span className="ml-auto flex items-center gap-4 text-[12.5px] text-muted">
          <Key className="bg-white/30">GitHub</Key>
          <Key className="bg-accent">Unmerged</Key>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-2.5">
        <Toggle label="Visit" options={VISITS} value={visit} onChange={setVisit} />
        <Toggle label="Measure" options={METRICS} value={metric} onChange={setMetric} />
        {metric === 'time' && (
          <button
            type="button"
            onClick={play}
            className="ml-auto h-7 cursor-pointer rounded-full border border-line px-3 text-[12.5px] text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            Replay
          </button>
        )}
      </div>

      {GROUPS.map((g) => {
        const scale = Math.max(...g.scenarios.flatMap((s) => [value(s.github[visit], metric) ?? 0, value(s.unmerged[visit], metric) ?? 0])) * 1.06;
        const marks = ticks(scale);
        return (
          <section key={g.title} className="border-line not-first:border-t">
            <div className={`grid h-9 items-center gap-x-4 border-b border-line bg-white/[0.015] px-6 text-[12px] ${COLUMNS}`}>
              <h3 className="font-normal text-muted">{g.title}</h3>
              <div aria-hidden className="relative hidden h-full md:block">
                {marks.map((m) => (
                  <span
                    key={m}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10.5px] whitespace-nowrap text-subtle first:translate-x-0"
                    style={{ left: `${(m / scale) * 100}%` }}
                  >
                    {metric === 'time' ? `${+(m / 1000).toFixed(1)} s` : m === 0 ? '0' : size(m)}
                  </span>
                ))}
              </div>
              <span className="hidden text-right text-subtle md:block">Unmerged</span>
              <span className="hidden text-right text-subtle md:block">GitHub</span>
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {g.scenarios.map((s) => (
                <Row key={s.id} scenario={s} visit={visit} metric={metric} scale={scale} marks={marks} end={end} />
              ))}
            </ul>
          </section>
        );
      })}

      <Notes visit={visit} />
    </div>
  );
}

/**
 * One page: its name, GitHub's bar above Unmerged's, both values and the ratio. On phones the name and ratio come
 * first, then the bars, then the values with their names.
 */
function Row({ scenario: s, visit, metric, scale, marks, end }: { scenario: Scenario; visit: Visit; metric: Metric; scale: number; marks: number[]; end: number }) {
  const github = value(s.github[visit], metric);
  const unmerged = value(s.unmerged[visit], metric);
  const ratio = compare(github, unmerged);
  const format = (v: number | null) => (metric === 'time' ? time(v) : size(v ?? 0));
  // With Time, the ratio fades in once both sides are done; a side with no content is done at the end.
  const done = Math.max(github ?? end, unmerged ?? end);
  return (
    <li className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-6 py-3 md:py-2.5 ${COLUMNS}`}>
      <div className="col-span-2 min-w-0 leading-tight md:col-span-1">
        <a href={s.url} className="block truncate text-[13.5px] font-medium text-fg hover:underline hover:underline-offset-2">
          {s.label}
        </a>
        <p className="truncate text-[12px] text-subtle">{s.detail}</p>
      </div>
      <div aria-hidden className="relative col-span-3 row-start-2 h-[18px] md:col-span-1 md:col-start-2 md:row-start-1">
        {marks.slice(1).map((m) => (
          <div key={m} className="absolute -inset-y-2.5 hidden w-px bg-white/[0.04] md:block" style={{ left: `${(m / scale) * 100}%` }} />
        ))}
        <Bar value={github} scale={scale} end={end} metric={metric} className="top-0 bg-white/30" />
        <Bar value={unmerged} scale={scale} end={end} metric={metric} className="bottom-0 bg-accent" />
      </div>
      <Value side="Unmerged" text={format(unmerged)} until={metric === 'time' ? (unmerged ?? end) : null} className="row-start-3 text-fg md:col-start-3 md:row-start-1" />
      <Value side="GitHub" text={format(github)} until={metric === 'time' ? (github ?? end) : null} className="row-start-3 text-muted md:col-start-4 md:row-start-1" />
      <span
        aria-hidden
        className={`col-start-3 row-start-1 justify-self-end rounded-full px-2 py-0.5 font-mono text-[12px] whitespace-nowrap md:col-start-5 ${ratio.worse ? 'bg-white/[0.06] text-muted' : 'bg-accent/20 text-[#c1c0ff]'}`}
        style={metric === 'time' ? { opacity: `clamp(0, calc((var(--t) - ${done - 150}) / 150), 1)` } : undefined}
      >
        {ratio.label}
      </span>
      <span className="sr-only">
        Unmerged {format(unmerged)}, GitHub {format(github)}, {ratio.label}
      </span>
    </li>
  );
}

/**
 * One side's bar. With Time it grows with `--t` until this side's time; a side that never showed the content runs
 * to the end of the scale and fades out. With Data it has its final size.
 */
function Bar({ value, scale, end, metric, className }: { value: number | null; scale: number; end: number; metric: Metric; className: string }) {
  return (
    <div
      className={`absolute left-0 h-[7px] origin-left rounded-full transition-[width] duration-500 ease-spring ${className} ${value === null ? 'rounded-r-none [mask-image:linear-gradient(to_right,black_55%,transparent)]' : ''}`}
      style={{
        width: `${((value ?? scale) / scale) * 100}%`,
        scale: metric === 'time' ? `clamp(0, calc(var(--t) / ${value ?? end}), 1) 1` : undefined,
      }}
    />
  );
}

/**
 * A side's value. With Time (`until` set) playback counts it up until `until`, then writes the final text; on phones
 * the side's name stands before it.
 */
function Value({ side, text, until, className }: { side: string; text: string; until: number | null; className: string }) {
  return (
    <span aria-hidden className={`font-mono text-[12.5px] whitespace-nowrap tabular-nums md:text-right ${className}`}>
      <span className="mr-1.5 font-sans text-subtle md:hidden">{side}</span>
      <span data-until={until ?? undefined} data-final={text}>
        {text}
      </span>
    </span>
  );
}

/** Lines under the rows for what a median hides: some runs with no content, and how long the main thread was blocked. */
function Notes({ visit }: { visit: Visit }) {
  const sides = [
    ['GitHub', 'github'],
    ['Unmerged', 'unmerged'],
  ] as const;
  const timeouts = results.scenarios.flatMap((s) =>
    sides.flatMap(([name, key]) => {
      const { runs } = s[key][visit];
      // When every run missed, the row already says so.
      const missed = runs.filter((run) => run === null).length;
      return missed && missed < runs.length ? [`${name} showed no content within ${TIMEOUT} in ${missed} of ${runs.length} runs of ${s.label}.`] : [];
    }),
  );
  const blocking = (key: 'github' | 'unmerged') => Math.max(...results.scenarios.map((s) => s[key][visit].blockingMs));
  const github = blocking('github');
  const unmerged = blocking('unmerged');
  const lines = [
    ...timeouts,
    ...(Math.max(github, unmerged) >= NOTABLE_BLOCKING ? [`Main thread blocked, at most: GitHub ${blockingTime(github)}, Unmerged ${blockingTime(unmerged)}.`] : []),
  ];
  if (!lines.length) return null;
  return (
    <div className="space-y-1 border-t border-line px-6 py-3 text-[12px] leading-relaxed text-subtle">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-full border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className="h-6 cursor-pointer rounded-full px-2.5 text-[12.5px] text-muted transition-colors hover:text-fg aria-pressed:bg-elevated aria-pressed:text-fg"
        >
          {o.label}
        </button>
      ))}
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

/**
 * How many times less Unmerged needed than GitHub. A GitHub page with no content in 60 s gives a floor: at least
 * 60 s over Unmerged's time. `worse` when Unmerged needed more.
 */
function compare(github: number | null, unmerged: number | null): { label: string; worse: boolean } {
  if (!unmerged) return { label: '—', worse: true };
  if (github === null) return { label: `>${Math.floor(TIMEOUT_MS / unmerged)}×`, worse: false };
  const ratio = github / unmerged;
  return ratio >= 1 ? { label: `${times(ratio)}×`, worse: false } : { label: `${times(1 / ratio)}× more`, worse: true };
}

/** Round marks for a scale: a step of 1, 2 or 5 (× a power of 10) that gives about five of them. */
function ticks(max: number) {
  const raw = max / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

const geometricMean = (ratios: number[]) => Math.exp(ratios.reduce((sum, r) => sum + Math.log(r), 0) / ratios.length);
const times = (ratio: number) => (ratio >= 10 ? String(Math.round(ratio)) : ratio.toFixed(1));
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const time = (ms: number | null) => (ms === null ? `none in ${TIMEOUT}` : seconds(ms));
const size = (bytes: number) => (bytes >= 1e6 ? `${+(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`);
const blockingTime = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

/** How the results were measured, for the section's text. */
export const benchmarkSetup = { pages: LOADS.length, runs: results.runs, date: results.date, signedIn: results.signedIn };
