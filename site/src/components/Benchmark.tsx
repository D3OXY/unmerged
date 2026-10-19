import { useState } from 'react';
import results from '../../../bench/results/latest.json';

type Visit = 'cold' | 'warm';
type Side = (typeof results.scenarios)[number]['github'][Visit];

const VISITS: { id: Visit; label: string }[] = [
  { id: 'cold', label: 'First visit' },
  { id: 'warm', label: 'Repeat visit' },
];

/**
 * The benchmark in bench/ (results/latest.json), page by page: time until the content shows as a bar per side,
 * and what each side downloaded. A switch moves between first and repeat visits. Every number comes from the
 * committed results, so the section stays true when the benchmark runs again.
 */
export function Benchmark() {
  const [visit, setVisit] = useState<Visit>('cold');
  return (
    <div className="rounded-2xl border border-line bg-panel/60">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-6 py-4">
        <span className="flex items-center gap-4 text-[12.5px] text-muted">
          <Key className="bg-white/25">GitHub</Key>
          <Key className="bg-accent">Unmerged</Key>
        </span>
        <div role="radiogroup" aria-label="Visit" className="ml-auto flex rounded-full border border-line p-0.5">
          {VISITS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={visit === v.id}
              onClick={() => setVisit(v.id)}
              className="h-7 cursor-pointer rounded-full px-3 text-[12.5px] text-muted transition-colors hover:text-fg aria-checked:bg-white/[0.08] aria-checked:text-fg"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {results.scenarios.map((s) => (
          <Row key={s.id} label={s.label} detail={s.detail} url={s.url} github={s.github[visit]} unmerged={s.unmerged[visit]} />
        ))}
      </ul>
    </div>
  );
}

/** One page: its two time bars, scaled to the slower side, and the data each side downloaded. */
function Row({ label, detail, url, github, unmerged }: { label: string; detail: string; url: string; github: Side; unmerged: Side }) {
  const longest = Math.max(github.ms ?? 0, unmerged.ms ?? 0) || 1;
  const less = github.bytes / Math.max(unmerged.bytes, 1);
  return (
    <li className="grid gap-x-8 gap-y-4 px-6 py-5 md:grid-cols-[200px_minmax(0,1fr)_150px] md:items-center">
      <div>
        <a href={url} className="text-[14px] font-medium text-fg hover:underline hover:underline-offset-2">
          {label}
        </a>
        <p className="mt-0.5 text-[12.5px] leading-snug text-subtle">{detail}</p>
      </div>
      <div className="space-y-1.5">
        <Bar ms={github.ms} longest={longest} className="bg-white/25" name="GitHub" />
        <Bar ms={unmerged.ms} longest={longest} className="bg-accent" name="Unmerged" />
      </div>
      <div className="text-[12.5px] md:text-right">
        <p className="font-mono text-muted">
          {size(github.bytes)} <span className="text-subtle">→</span> <span className="text-fg">{size(unmerged.bytes)}</span>
        </p>
        <p className="mt-0.5 text-subtle">{less >= 1.5 ? `${Math.round(less)}× less data` : less >= 1 ? 'About the same data' : `${(1 / less).toFixed(1)}× more data`}</p>
      </div>
    </li>
  );
}

/** A time bar; its width animates when the visit changes. A side that never showed the content gets a note. */
function Bar({ ms, longest, className, name }: { ms: number | null; longest: number; className: string; name: string }) {
  return (
    <div role="img" aria-label={`${name}: ${time(ms)}`} className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div className={`h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${className}`} style={{ width: `${((ms ?? longest) / longest) * 100}%` }} />
      </div>
      <span className="w-14 text-right font-mono text-[12.5px] text-muted">{time(ms)}</span>
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

const time = (ms: number | null) => (ms === null ? '> 60 s' : `${(ms / 1000).toFixed(2)} s`);
const size = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`);

/** Facts for the section's copy, worked out from the results so the words can't drift from the numbers. */
export function benchmarkSummary() {
  const cold = results.scenarios.map((s) => ({ github: s.github.cold, unmerged: s.unmerged.cold }));
  const ratios = cold.map((c) => c.github.bytes / Math.max(c.unmerged.bytes, 1));
  const faster = cold.filter((c) => c.unmerged.ms !== null && (c.github.ms === null || c.unmerged.ms < c.github.ms)).length;
  return {
    pages: cold.length,
    faster,
    minLess: Math.round(Math.min(...ratios)),
    maxLess: Math.round(Math.max(...ratios)),
    date: results.date,
    runs: results.runs,
    signedIn: results.signedIn,
  };
}
