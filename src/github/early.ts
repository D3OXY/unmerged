import { browser } from '#imports';

// Early requests. On a page we own, the content script can't start a request until GitHub's <head> has arrived
// (it then calls `window.stop()`, which cancels requests in flight), and the app that makes them loads after
// that. So when a tab starts to load an owned page, or the user points at a link to one before the app has
// loaded, the background starts the page's first API requests at once (see background.ts), and keeps each answer
// for a short time. The page then takes the background's answer instead of making the same request again. A request
// matches only when it is the same request: method, URL, headers (all but the token) and body.

/** How long the background keeps an answer, and how long a new page asks for one. */
const KEEP_MS = 15_000;

/** A response as it crosses from the background to the page. `body` is null for a status that has no body. */
type Answer = { status: number; headers: [string, string][]; body: string | null };

// Background: the answers a page can take, by request key.
const kept = new Map<string, Promise<Answer | null>>();
let keeping = false;
// Page: until when its requests ask the background first.
let takingUntil = 0;

/**
 * `fetch` for every API request (see client.ts). In the background, after `keepEarlyAnswers`, it keeps each
 * answer for a page to take. In a page, after `takeEarlyAnswers`, it takes the background's answer when there is one.
 */
export async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  if (Date.now() < takingUntil) {
    const answer: Answer | null = await browser.runtime.sendMessage({ type: 'early', key: keyOf(url, init) }).catch(() => null);
    if (answer) return new Response(answer.body, { status: answer.status, headers: answer.headers });
  }
  const response = fetch(url, init);
  if (keeping) keep(keyOf(url, init), response);
  return response;
}

/**
 * Background: from now on, keeps the answer to every API request. Pages take them with `answerEarly`. Code
 * search's answers are kept too; no page asks for them, so they go after KEEP_MS.
 */
export function keepEarlyAnswers() {
  keeping = true;
}

/** Page: its requests in the next seconds ask the background first. Call it when the app starts in a page. */
export function takeEarlyAnswers() {
  takingUntil = Date.now() + KEEP_MS;
}

/**
 * Page, before the app has loaded: asks the background to start the requests of the owned page at `url` (a link
 * the user points at), so they don't wait for the app. The app takes their answers once it starts.
 */
export function prefetchInBackground(url: URL) {
  browser.runtime.sendMessage({ type: 'prefetch', url: url.href }).catch(() => {});
}

/** The background's half of `prefetchInBackground`: the URL to prefetch, or null for any other message. */
export function prefetchRequest(message: unknown): URL | null {
  if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'prefetch') return null;
  if (!('url' in message) || typeof message.url !== 'string') return null;
  return URL.parse(message.url);
}

/** The background's half of `apiFetch`: the kept answer, once, or null. Returns null for any other message. */
export function answerEarly(message: unknown): Promise<Answer | null> | null {
  if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'early') return null;
  if (!('key' in message) || typeof message.key !== 'string') return null;
  const answer = kept.get(message.key) ?? Promise.resolve(null);
  kept.delete(message.key);
  return answer;
}

/** Keeps a request's answer for KEEP_MS, or until a page takes it. A failed request keeps null. */
function keep(key: string, response: Promise<Response>) {
  // Copied before whoever made the request reads the body: this callback was added to `response` first.
  const answer = response.then(async (res): Promise<Answer> => {
    const copy = res.clone();
    return { status: copy.status, headers: [...copy.headers], body: copy.body ? await copy.text() : null };
  });
  const entry = answer.catch(() => null);
  kept.set(key, entry);
  setTimeout(() => {
    if (kept.get(key) === entry) kept.delete(key);
  }, KEEP_MS);
}

/** What makes two API requests the same. The token is left out: background and page read the same one. */
export function keyOf(url: string, init: RequestInit) {
  const headers = Object.entries(init.headers ?? {}).filter(([name]) => name.toLowerCase() !== 'authorization');
  return JSON.stringify([init.method ?? 'GET', url, headers, init.body ?? null]);
}
