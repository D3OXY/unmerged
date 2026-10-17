/** What a log line is, from the runner's `##[error]`-style commands (and `[command]` for commands it ran). */
export type LineKind = 'error' | 'warning' | 'notice' | 'debug' | 'command' | 'group';

/**
 * One line of a step's log, numbered from 1 within the step. `group` is the number of the `##[group]` header
 * it folds under; headers have kind 'group'.
 */
export type LogLine = { number: number; text: string; kind?: LineKind; group?: number };

/** The parts of a job's step the log is split by (the REST API's fields). */
export type StepTiming = { number: number; conclusion: string | null; started_at: string | null; completed_at: string | null };

const STAMP = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.\d+)?Z ?/;
const COMMAND = /^##\[(error|warning|notice|debug|group)\]/;
// The first line of a top-level step: a `run`/`uses` step's header, a post step, or "Complete job".
const STEP_START = /^(##\[group\]Run |Post job cleanup\.$|Cleaning up orphan processes$)/;

/**
 * Splits a job's log (one file, every line timestamped) into its steps' logs, keyed by step number.
 *
 * Steps only have start and end times to the second, and several often start in the same second, so a
 * line moves to the next step when the current one has ended by its timestamp, or when it's the first line
 * of a step (`STEP_START`) and the next step has begun. Lines inside a composite action (between
 * `##[start-action]` and `##[end-action]`) never start a step. Skipped steps have no log.
 */
export function splitLog(log: string, steps: StepTiming[]): Map<number, LogLine[]> {
  const timed = steps
    .filter((s) => s.started_at && s.conclusion !== 'skipped')
    .map((s) => ({ number: s.number, start: Date.parse(s.started_at!), end: s.completed_at ? Date.parse(s.completed_at) : Infinity }));
  const out = new Map<number, LogLine[]>(timed.map((s) => [s.number, []]));
  if (!timed.length) return out;

  let current = 0;
  let lines = out.get(timed[0]!.number)!;
  let depth = 0;
  let group: number | undefined;
  let second = 0;
  const advance = () => {
    lines = out.get(timed[++current]!.number)!;
    group = undefined;
  };

  for (const raw of log.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const stamp = STAMP.exec(raw);
    if (!stamp && !raw) continue;
    if (stamp) second = Date.parse(`${stamp[1]}Z`);
    let text = stamp ? raw.slice(stamp[0].length) : raw;

    while (current + 1 < timed.length && timed[current + 1]!.start <= second) {
      if (second > timed[current]!.end) {
        advance();
        depth = 0;
        continue;
      }
      if (depth === 0 && lines.length && STEP_START.test(text)) advance();
      break;
    }

    if (text.startsWith('##[start-action')) {
      depth++;
      continue;
    }
    if (text.startsWith('##[end-action')) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (text.startsWith('##[endgroup]')) {
      group = undefined;
      continue;
    }

    const command = COMMAND.exec(text);
    const kind: LineKind | undefined = command ? (command[1] as LineKind) : text.startsWith('[command]') ? 'command' : undefined;
    if (command) text = text.slice(command[0].length);
    else if (kind === 'command') text = text.slice('[command]'.length);

    const number = lines.length + 1;
    if (kind === 'group') {
      lines.push({ number, text, kind });
      group = number;
    } else lines.push({ number, text, kind, group });
  }
  return out;
}

/** A run of text in one style, from the ANSI SGR codes before it. Colors are CSS colors. */
export type Span = { text: string; fg?: string; bg?: string; bold?: boolean; dim?: boolean; italic?: boolean; underline?: boolean };

type Style = Omit<Span, 'text'>;

// The 16 basic colors. Theme-aware where it matters: black and white follow the text color, so they never
// vanish into the background. `--log-cyan` is set by the log view.
const BASIC = [
  'var(--u-subtle)', 'var(--u-red)', 'var(--u-green)', 'var(--u-yellow)', 'var(--u-blue)', 'var(--u-purple)', 'var(--log-cyan)', 'var(--u-fg)',
  'var(--u-muted)', 'var(--u-red)', 'var(--u-green)', 'var(--u-yellow)', 'var(--u-blue)', 'var(--u-purple)', 'var(--log-cyan)', 'var(--u-fg)',
];

/** One of the 256 xterm colors: the basic 16, a 6×6×6 cube, then 24 greys. */
function xterm(n: number): string | undefined {
  if (n < 0 || n > 255) return;
  if (n < 16) return BASIC[n];
  if (n >= 232) return `rgb(${Array(3).fill(8 + (n - 232) * 10).join(' ')})`;
  const level = (c: number) => (c ? 55 + c * 40 : 0);
  const i = n - 16;
  return `rgb(${level(Math.floor(i / 36))} ${level(Math.floor(i / 6) % 6)} ${level(i % 6)})`;
}

/** Applies one SGR sequence's parameters (`1;31`, `38;5;208`, `38;2;r;g;b`…) to a style. */
function applySgr(style: Style, params: number[]): Style {
  let next = { ...style };
  for (let i = 0; i < params.length; i++) {
    const p = params[i]!;
    if (p === 0) next = {};
    else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4) next.underline = true;
    else if (p === 22) next.bold = next.dim = undefined;
    else if (p === 23) next.italic = undefined;
    else if (p === 24) next.underline = undefined;
    else if (p >= 30 && p <= 37) next.fg = BASIC[p - 30];
    else if (p >= 90 && p <= 97) next.fg = BASIC[p - 90 + 8];
    else if (p >= 40 && p <= 47) next.bg = BASIC[p - 40];
    else if (p >= 100 && p <= 107) next.bg = BASIC[p - 100 + 8];
    else if (p === 39) next.fg = undefined;
    else if (p === 49) next.bg = undefined;
    else if (p === 38 || p === 48) {
      const key = p === 38 ? 'fg' : 'bg';
      if (params[i + 1] === 5) {
        next[key] = xterm(params[i + 2] ?? -1);
        i += 2;
      } else if (params[i + 1] === 2) {
        next[key] = `rgb(${params.slice(i + 2, i + 5).join(' ')})`;
        i += 4;
      }
    }
  }
  return next;
}

// Any CSI escape; only SGR (ending in `m`) changes the style, the rest (cursor moves, erase line) is dropped.
const CSI = /\x1b\[([0-9;?]*)([A-Za-z])/g;

/** A line's text split into styled spans by its ANSI color codes, which are removed. */
export function ansiSpans(text: string): Span[] {
  const spans: Span[] = [];
  let style: Style = {};
  let last = 0;
  const push = (end: number) => {
    if (end > last) spans.push({ text: text.slice(last, end), ...style });
  };
  for (const match of text.matchAll(CSI)) {
    push(match.index);
    last = match.index + match[0].length;
    if (match[2] === 'm') style = applySgr(style, match[1] ? match[1].split(';').map(Number) : [0]);
  }
  push(text.length);
  return spans;
}
