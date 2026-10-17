import type { TextMatch } from './queries';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Splits a code search fragment into plain and matched runs, for rendering as text (never as HTML). GitHub's
 * `indices` count UTF-8 bytes, not characters; overlapping or out-of-range matches are skipped.
 */
export function highlight({ fragment, matches }: TextMatch): { text: string; match: boolean }[] {
  const bytes = encoder.encode(fragment);
  const runs: { text: string; match: boolean }[] = [];
  let at = 0;
  const run = (end: number, match: boolean) => runs.push({ text: decoder.decode(bytes.subarray(at, (at = end))), match });
  for (const [start, end] of matches.map((m) => m.indices).sort(([a], [b]) => a - b)) {
    if (start < at || end <= start || end > bytes.length) continue;
    if (start > at) run(start, false);
    run(end, true);
  }
  if (at < bytes.length) run(bytes.length, false);
  return runs;
}

/** A code search fragment with its matches marked. Plain React text, so the code is always escaped. */
export function Highlighted({ match }: { match: TextMatch }) {
  return highlight(match).map((run, i) =>
    run.match ? (
      <mark key={i} className="rounded-sm bg-warning/25 text-fg">
        {run.text}
      </mark>
    ) : (
      run.text
    ),
  );
}
