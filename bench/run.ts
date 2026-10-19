import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type BrowserContext } from 'playwright';

// Unmerged vs GitHub's own pages, in the same headless Chromium. See bench/README.md for the method.
// Usage: pnpm build && pnpm bench [--runs 5] [--only repo,pr] [--no-write]
// UNMERGED_EXTENSION points at another build (default: this checkout's .output/chrome-mv3).

/** A page to load, and a piece of its content: the load counts as done when that text is on screen. */
export type Scenario = { id: string; label: string; detail: string; url: string; marker: string };

export const SCENARIOS: Scenario[] = [
  {
    id: 'repo',
    label: 'Repository',
    detail: 'TanStack/query, up to its README',
    url: 'https://github.com/TanStack/query',
    marker: 'An async state management library built to simplify fetching',
  },
  {
    id: 'pr',
    label: 'Pull request',
    detail: 'A small PR, up to its description (#12030)',
    url: 'https://github.com/TanStack/query/pull/12030',
    marker: 'failed type checking with',
  },
  {
    id: 'issue',
    label: 'Long issue',
    detail: '91 comments, up to the newest one (#1657)',
    url: 'https://github.com/TanStack/query/issues/1657',
    marker: 'the two identical requests can clobber the same key',
  },
  {
    id: 'files',
    label: 'Files changed, 133 files',
    detail: '+1 −668 lines, up to the first diff (#11827)',
    url: 'https://github.com/TanStack/query/pull/11827/files',
    marker: 'flat/recommended-typescript',
  },
  {
    id: 'huge',
    label: 'Files changed, 2,416 files',
    detail: '+56,023 −39,471 lines, up to the first diff (#12054)',
    url: 'https://github.com/TanStack/query/pull/12054/files',
    marker: 'incorporate upstream adapter fixes',
  },
];

type Visit = 'cold' | 'warm';
/** One page load: ms until the marker showed (null if it never did), bytes and requests over the network, and main-thread blocking. */
type Load = { ms: number | null; bytes: number; requests: number; blockingMs: number };
type Summary = { ms: number | null; bytes: number; requests: number; blockingMs: number; runs: (number | null)[] };
export type Results = {
  date: string;
  runs: number;
  /** Whether both sides loaded github.com signed in (see SESSION). */
  signedIn: boolean;
  userAgent: string;
  scenarios: (Scenario & { github: Record<Visit, Summary>; unmerged: Record<Visit, Summary> })[];
};

const ROOT = resolve(import.meta.dirname, '..');
const EXTENSION = resolve(process.env.UNMERGED_EXTENSION ?? join(ROOT, '.output/chrome-mv3'));
/** A signed-in github.com session from `pnpm bench:login`; when present, both sides load signed in. */
export const SESSION = join(ROOT, 'bench/.auth/github.json');
const RESULTS = join(ROOT, 'bench/results/latest.json');
const README = join(ROOT, 'bench/README.md');
const TIMEOUT = 60_000;

/** Milliseconds of network after the marker shows that still count: late requests for the same view. */
const SETTLE = 2000;

async function main() {
  const { values } = parseArgs({ options: { runs: { type: 'string', default: '5' }, only: { type: 'string' }, 'no-write': { type: 'boolean', default: false } } });
  const runs = Number(values.runs);
  const only = values.only?.split(',');
  const scenarios = only ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;
  if (!existsSync(EXTENSION)) throw new Error('Build the extension first: pnpm build');
  const token = process.env.GITHUB_TOKEN ?? execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  if (!token) throw new Error('Set GITHUB_TOKEN (a read-only token is enough) or sign in with the GitHub CLI');
  const session: { cookies: Parameters<BrowserContext['addCookies']>[0] } | null = existsSync(SESSION) ? JSON.parse(readFileSync(SESSION, 'utf8')) : null;
  console.log(session ? 'Signed in to github.com (bench/.auth/github.json)' : 'Signed out of github.com (run pnpm bench:login to compare signed in)');

  let userAgent = '';
  const results: Results['scenarios'] = [];
  for (const scenario of scenarios) {
    const loads = { github: { cold: [] as Load[], warm: [] as Load[] }, unmerged: { cold: [] as Load[], warm: [] as Load[] } };
    for (let run = 0; run < runs; run++) {
      for (const product of ['github', 'unmerged'] as const) {
        // A fresh profile per run: the first visit is cold, the second one (same profile) is warm.
        const dir = mkdtempSync(join(tmpdir(), 'unmerged-bench-'));
        const context = await chromium.launchPersistentContext(dir, {
          channel: 'chromium',
          headless: true,
          viewport: { width: 1440, height: 900 },
          args: product === 'unmerged' ? [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`] : [],
        });
        try {
          if (session) await context.addCookies(session.cookies);
          if (product === 'unmerged') await saveToken(context, token);
          for (const visit of ['cold', 'warm'] as const) {
            const load = await measure(context, scenario);
            loads[product][visit].push(load);
            console.log(`${scenario.id} ${product} ${visit} #${run + 1}: ${load.ms === null ? 'timed out' : `${Math.round(load.ms)} ms`}, ${kb(load.bytes)}, ${load.requests} requests, ${Math.round(load.blockingMs)} ms blocking`);
          }
          userAgent ||= await context.pages()[0]?.evaluate(() => navigator.userAgent) ?? '';
        } finally {
          await context.close();
          rmSync(dir, { recursive: true, force: true });
        }
      }
    }
    results.push({
      ...scenario,
      github: { cold: summarize(loads.github.cold), warm: summarize(loads.github.warm) },
      unmerged: { cold: summarize(loads.unmerged.cold), warm: summarize(loads.unmerged.warm) },
    });
  }

  if (values['no-write']) return;
  const previous: Results | null = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, 'utf8')) : null;
  // A partial run (--only) replaces just its scenarios in the saved results.
  const merged = previous && only ? previous.scenarios.map((s) => results.find((r) => r.id === s.id) ?? s) : results;
  const out: Results = { date: new Date().toISOString().slice(0, 10), runs, signedIn: !!session, userAgent, scenarios: merged };
  writeFileSync(RESULTS, `${JSON.stringify(out, null, 2)}\n`);
  writeFileSync(README, readFileSync(README, 'utf8').replace(/<!-- results -->[\s\S]*<!-- \/results -->/, `<!-- results -->\n${table(out)}\n<!-- /results -->`));
  console.log(`\nWrote ${RESULTS} and the table in ${README}`);
}

/** Saves the token through Unmerged's own popup, as a user would. */
async function saveToken(context: BrowserContext, token: string) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  await popup.locator('input[type=password]').fill(token);
  await popup.getByRole('button', { name: 'Save' }).click();
  await popup.waitForFunction(() => !document.querySelector('input[type=password]'));
  await popup.close();
}

/** Loads the scenario's page in a new tab and measures it until the marker text is visible. */
async function measure(context: BrowserContext, scenario: Scenario): Promise<Load> {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // Only http(s) requests that went over the network: not the extension's own files, not answers from the cache.
  const network = new Set<string>();
  let bytes = 0;
  let requests = 0;
  let counting = true;
  cdp.on('Network.responseReceived', (e) => {
    const { url, fromDiskCache, fromPrefetchCache, fromServiceWorker } = e.response;
    if (/^https?:/.test(url) && !fromDiskCache && !fromPrefetchCache && !fromServiceWorker) network.add(e.requestId);
  });
  cdp.on('Network.requestServedFromCache', (e) => network.delete(e.requestId));
  cdp.on('Network.loadingFinished', (e) => {
    if (!counting || !network.has(e.requestId)) return;
    bytes += e.encodedDataLength;
    requests++;
  });
  // Main-thread blocking: the part of every long task past 50 ms, as in Total Blocking Time.
  await page.addInitScript(() => {
    const w = window as unknown as { __blocking: number };
    w.__blocking = 0;
    new PerformanceObserver((list) => {
      for (const task of list.getEntries()) w.__blocking += task.duration - 50;
    }).observe({ type: 'longtask', buffered: true });
  });

  // GitHub's pages stop loading under Unmerged (window.stop), so load events never fire: wait for the commit only.
  await page.goto(scenario.url, { waitUntil: 'commit' });
  let ms: number | null = null;
  try {
    const handle = await page.waitForFunction(findMarker, scenario.marker, { polling: 50, timeout: TIMEOUT });
    ms = (await handle.jsonValue()) as number;
  } catch {
    ms = null;
  }
  const blockingMs = await page.evaluate(() => (window as unknown as { __blocking: number }).__blocking);
  await page.waitForTimeout(SETTLE);
  counting = false;
  await page.close();
  return { ms, bytes, requests, blockingMs };
}

/**
 * Runs in the page: performance.now() once `marker` is in a visible text node, false until then. It looks in the
 * document, in shadow roots on the top-level elements (where Unmerged mounts) and in the shadow roots nested in
 * those, and skips script and template text, where GitHub embeds page data before it renders it.
 */
function findMarker(marker: string): number | false {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const el of [...document.documentElement.children, ...(document.body?.children ?? [])]) if (el.shadowRoot) roots.push(el.shadowRoot);
  // Inside those, every nested shadow root too: @pierre/diffs draws each diff in its own.
  for (let i = 1; i < roots.length; i++) for (const el of roots[i]!.querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node as Text).data.includes(marker)) continue;
      const el = node.parentElement;
      if (!el || el.closest('script, style, template, noscript')) continue;
      if (el.checkVisibility() && el.getClientRects().length > 0) return performance.now();
    }
  }
  return false;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Medians over the runs. A visit that timed out in most runs has no time (null). */
function summarize(loads: Load[]): Summary {
  const times = loads.map((l) => l.ms).filter((ms): ms is number => ms !== null);
  return {
    ms: times.length * 2 > loads.length ? Math.round(median(times)) : null,
    bytes: Math.round(median(loads.map((l) => l.bytes))),
    requests: Math.round(median(loads.map((l) => l.requests))),
    blockingMs: Math.round(median(loads.map((l) => l.blockingMs))),
    runs: loads.map((l) => (l.ms === null ? null : Math.round(l.ms))),
  };
}

const kb = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`);
const time = (ms: number | null) => (ms === null ? `> ${TIMEOUT / 1000} s` : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`);

/** The Markdown table in bench/README.md. */
function table(results: Results) {
  const rows = results.scenarios.flatMap((s) =>
    (['cold', 'warm'] as const).map((visit) => {
      const g = s.github[visit];
      const u = s.unmerged[visit];
      return `| ${s.label} | ${visit === 'cold' ? 'First visit' : 'Repeat visit'} | ${time(g.ms)} | ${time(u.ms)} | ${kb(g.bytes)} | ${kb(u.bytes)} | ${g.requests} | ${u.requests} | ${g.blockingMs} ms | ${u.blockingMs} ms |`;
    }),
  );
  return [
    `Measured ${results.date}, median of ${results.runs} runs, ${results.signedIn ? 'signed in to' : 'signed out of'} github.com. ${results.userAgent}`,
    '',
    '| Page | Visit | Time GitHub | Time Unmerged | Data GitHub | Data Unmerged | Requests GitHub | Requests Unmerged | Blocking GitHub | Blocking Unmerged |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

if (import.meta.main) await main();
