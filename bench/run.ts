import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type BrowserContext, type Request } from 'playwright';

// Unmerged vs GitHub's own pages, in the same headless Chromium. See bench/README.md for the method.
// Usage: pnpm build && pnpm bench [--runs 5] [--only repo,to-pulls] [--no-write]
// UNMERGED_EXTENSION points at another build (default: this checkout's .output/chrome-mv3).

/**
 * A page to load, and a piece of its content: the load counts as done when that text is on screen. A marker that
 * changes over time is a function, read from the API when the scenario starts. With `from`, a click inside a
 * page: load `from.url`, hover the first visible link that matches `from.link` as a user would, click it, and
 * time from the click.
 */
export type Scenario = {
  id: string;
  label: string;
  detail: string;
  url: string;
  marker: string | ((token: string) => Promise<string>);
  from?: { url: string; link: string };
};

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
  // Bun's rewrite in Rust: the biggest pull request here by far, in its own repository.
  {
    id: 'bun-pr',
    label: 'Very long pull request',
    detail: '707 comments and 170 reviews, up to its description (oven-sh/bun#30412)',
    url: 'https://github.com/oven-sh/bun/pull/30412',
    marker: 'compiler-assisted tools for catching',
  },
  {
    id: 'bun-files',
    label: 'Files changed, 2,188 files',
    detail: '+1,009,257 −4,024 lines, up to the first diff (oven-sh/bun#30412)',
    url: 'https://github.com/oven-sh/bun/pull/30412/files',
    marker: 'Serialize Apply-phase agents',
  },
  // Clicks inside a page. Links match by the end of their href: GitHub's are paths, some of Unmerged's are full
  // URLs, and Unmerged's sidebar has links with the same names.
  {
    id: 'to-pulls',
    label: 'Repository → Pull requests',
    detail: 'The Pull requests tab, up to the newest open PR',
    url: 'https://github.com/TanStack/query/pulls',
    marker: newestOpenPr,
    from: { url: 'https://github.com/TanStack/query', link: 'a[href$="/TanStack/query/pulls"]:visible' },
  },
  {
    id: 'to-pr',
    label: 'Pull requests → a PR',
    detail: 'From a list of merged PRs, up to its description (#12030)',
    url: 'https://github.com/TanStack/query/pull/12030',
    marker: 'failed type checking with',
    // Merged on one day: a list that doesn't change.
    from: { url: 'https://github.com/TanStack/query/pulls?q=is%3Apr+is%3Amerged+merged%3A2026-10-17', link: 'a[href$="/TanStack/query/pull/12030"]:visible' },
  },
  {
    id: 'to-files',
    label: 'Pull request → Files changed',
    detail: 'The Files changed tab, 133 files, up to the first diff (#11827)',
    url: 'https://github.com/TanStack/query/pull/11827/files',
    marker: 'flat/recommended-typescript',
    // GitHub's newer Files changed lives at /changes; either link counts.
    from: { url: 'https://github.com/TanStack/query/pull/11827', link: 'a[href$="/TanStack/query/pull/11827/files"]:visible, a[href$="/TanStack/query/pull/11827/changes"]:visible' },
  },
];

/** The newest open PR's title: the top row of the Pull requests tab on both sides, as both sort newest first. */
async function newestOpenPr(token: string) {
  const response = await fetch('https://api.github.com/repos/TanStack/query/pulls?per_page=1', { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Couldn't read the newest open PR: ${response.status}`);
  const [pr] = (await response.json()) as { title: string }[];
  if (!pr) throw new Error('TanStack/query has no open PR');
  // Code in backticks shows in its own element: the marker is the longest part of the title outside them.
  return pr.title.split(/`[^`]*`/).map((part) => part.trim()).reduce((a, b) => (b.length > a.length ? b : a));
}

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
  scenarios: (Scenario & { marker: string; github: Record<Visit, Summary>; unmerged: Record<Visit, Summary> })[];
};

// Unmerged's background starts a page's first requests (src/github/early.ts); Playwright reports a service
// worker's requests only with this set, before the browser launches.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

const ROOT = resolve(import.meta.dirname, '..');
const EXTENSION = resolve(process.env.UNMERGED_EXTENSION ?? join(ROOT, '.output/chrome-mv3'));
/** A signed-in github.com session from `pnpm bench:login`; when present, both sides load signed in. */
export const SESSION = join(ROOT, 'bench/.auth/github.json');
const RESULTS = join(ROOT, 'bench/results/latest.json');
const README = join(ROOT, 'bench/README.md');
const TIMEOUT = 60_000;

/** Milliseconds of network after the marker shows that still count: late requests for the same view. */
const SETTLE = 2000;
/** How long a click's pointer rests on the link first, as a user's would. */
const HOVER = 150;

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
  for (const { marker, ...rest } of scenarios) {
    const scenario = { ...rest, marker: typeof marker === 'string' ? marker : await marker(token) };
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
    // Saved after every page, so a failure later in the run keeps what was measured.
    if (!values['no-write']) save({ date: new Date().toISOString().slice(0, 10), runs, signedIn: !!session, userAgent, scenarios: results });
  }
  if (!values['no-write']) console.log(`\nWrote ${RESULTS} and the table in ${README}`);
}

/**
 * Writes results/latest.json and the table in the README. Pages measured now replace their earlier results;
 * pages not measured in this run (--only, or not reached yet) keep theirs.
 */
function save(run: Results) {
  const previous: Results | null = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, 'utf8')) : null;
  const scenarios = SCENARIOS.flatMap((s) => run.scenarios.find((r) => r.id === s.id) ?? previous?.scenarios.find((p) => p.id === s.id) ?? []);
  const out: Results = { ...run, scenarios };
  mkdirSync(dirname(RESULTS), { recursive: true });
  writeFileSync(RESULTS, `${JSON.stringify(out, null, 2)}\n`);
  writeFileSync(README, readFileSync(README, 'utf8').replace(/<!-- results -->[\s\S]*<!-- \/results -->/, `<!-- results -->\n${table(out)}\n<!-- /results -->`));
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

/**
 * Loads the scenario's page in a new tab and measures it until the marker text is visible. For a click, the start
 * page loads and settles first; only what happens from the hover on counts.
 */
async function measure(context: BrowserContext, scenario: Scenario & { marker: string }): Promise<Load> {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // The page's http(s) requests that went over the network: not the extension's own files, not answers from the cache.
  const network = new Set<string>();
  let bytes = 0;
  let requests = 0;
  let counting = !scenario.from;
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
  // Requests the extension's background makes for this page: the page's CDP session doesn't see them.
  const fromWorker = async (request: Request) => {
    if (!counting || !request.serviceWorker() || !/^https?:/.test(request.url())) return;
    const sizes = await request.sizes();
    bytes += sizes.responseBodySize + sizes.responseHeadersSize;
    requests++;
  };
  context.on('requestfinished', fromWorker);
  // Main-thread blocking: the part of every long task past 50 ms, as in Total Blocking Time.
  await page.addInitScript(() => {
    const w = window as unknown as { __blocking: number };
    w.__blocking = 0;
    new PerformanceObserver((list) => {
      for (const task of list.getEntries()) w.__blocking += task.duration - 50;
    }).observe({ type: 'longtask', buffered: true });
  });

  // GitHub's pages stop loading under Unmerged (window.stop), so load events never fire: wait for the commit only.
  await page.goto(scenario.from?.url ?? scenario.url, { waitUntil: 'commit' });
  // The click's start, in the page's clock (ms since the epoch); none for a page load.
  let since: number | undefined;
  if (scenario.from) {
    const link = page.locator(scenario.from.link).first();
    // A start page without the link (GitHub changed it, or the page failed) counts as a timeout, not a crash.
    const found = await link.waitFor({ timeout: TIMEOUT }).then(
      () => true,
      () => false,
    );
    if (!found) {
      console.log(`  ${scenario.id}: no link matching ${scenario.from.link} on ${scenario.from.url}`);
      context.off('requestfinished', fromWorker);
      await page.close();
      return { ms: null, bytes: 0, requests: 0, blockingMs: 0 };
    }
    await page.waitForTimeout(SETTLE);
    await page.evaluate(() => ((window as unknown as { __blocking: number }).__blocking = 0));
    counting = true;
    await link.hover();
    await page.waitForTimeout(HOVER);
    since = await page.evaluate(() => performance.timeOrigin + performance.now());
    // The pointer is on the link already: a click without Playwright's actionability waits.
    await page.mouse.down();
    await page.mouse.up();
  }
  let ms: number | null = null;
  try {
    const handle = await page.waitForFunction(findMarker, { marker: scenario.marker, since }, { polling: 50, timeout: TIMEOUT });
    ms = (await handle.jsonValue()) as number;
  } catch {
    ms = null;
  }
  const blockingMs = await page.evaluate(() => (window as unknown as { __blocking: number }).__blocking);
  await page.waitForTimeout(SETTLE);
  counting = false;
  context.off('requestfinished', fromWorker);
  await page.close();
  return { ms, bytes, requests, blockingMs };
}

/**
 * Runs in the page: once `marker` is in a visible text node, the ms since `since` (the epoch ms a click started),
 * or since the navigation started without it; false until then. It looks in the document, in shadow roots on the
 * top-level elements (where Unmerged mounts) and in the shadow roots nested in those, and skips script and
 * template text, where GitHub embeds page data before it renders it.
 */
function findMarker({ marker, since }: { marker: string; since?: number }): number | false {
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
      if (el.checkVisibility() && el.getClientRects().length > 0) return performance.timeOrigin + performance.now() - (since ?? performance.timeOrigin);
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
