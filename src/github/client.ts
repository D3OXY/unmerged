import { tokenItem } from '@/lib/settings';
import { formatTime } from '@/lib/time';

/** Why a GitHub request failed, in terms the UI can act on. */
export type GitHubProblem =
  | { kind: 'auth' | 'not-found' | 'other' }
  /** The token's rate limit (or a secondary limit) is spent until `resetAt`, in ms since the epoch. */
  | { kind: 'rate-limit'; resetAt: number }
  /** An organization's SAML SSO hasn't authorized the token. `authorizeUrl` is GitHub's page for it, when sent. */
  | { kind: 'sso'; authorizeUrl?: string };

/** What every failed GitHub request throws. `status` is the HTTP status (200 for errors in a GraphQL answer). */
export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problem: GitHubProblem = { kind: 'other' },
  ) {
    super(message);
  }
}

type GraphQLResponse<T> = { data?: T; errors?: { message: string; type?: string }[] };

// Read once and kept current, rather than a storage round trip for every request.
let currentToken = tokenItem.getValue();
tokenItem.watch((token) => (currentToken = Promise.resolve(token)));

async function authHeaders(): Promise<HeadersInit> {
  const token = await currentToken;
  if (!token) throw new GitHubError('No GitHub token configured', 401, { kind: 'auth' });
  return { Authorization: `Bearer ${token}` };
}

/**
 * Runs a GitHub GraphQL query. `allowPartial` returns whatever data came back even when
 * some fields errored (e.g. `user(login:)` on an organization resolves to null with an error).
 * Pass a query's `signal` so an abandoned fetch is cancelled.
 */
export async function gql<T>(query: string, variables: Record<string, unknown> = {}, allowPartial = false, signal?: AbortSignal): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (!res.ok) throw await httpError(res);

  const { data, errors = [] } = (await res.json()) as GraphQLResponse<T>;
  // Partial data is no answer when SSO nulled every field asked for (a repo in an org the token isn't
  // authorized for): showing it as "not found" would hide the fix.
  const ssoBlocked = data && errors.some((e) => /SAML/.test(e.message)) && Object.values(data).every((v) => v === null);
  if (errors.length && !(allowPartial && data && !ssoBlocked)) {
    throw classify(res, errors.map((e) => e.message).join('\n'), errors.map((e) => e.type));
  }
  if (!data) throw new GitHubError('GitHub returned no data', res.status);
  return data;
}

/** REST call returning JSON. GitHub's error message is surfaced as the thrown error. */
export async function rest<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method: init.method ?? 'GET',
    headers: { ...(await authHeaders()), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  if (!res.ok) throw await httpError(res);
  const text = await res.text(); // Some endpoints (re-runs, notification updates) answer with an empty body.
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * REST GET that also returns the response headers (paging links, poll intervals). `data` is null when a
 * conditional request (`If-Modified-Since`) answers 304 Not Modified; other failures throw like `rest`.
 */
export async function restWithHeaders<T>(
  path: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<{ data: T | null; headers: Headers }> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { ...(await authHeaders()), Accept: 'application/vnd.github+json', ...init.headers },
    signal: init.signal,
  });
  if (res.status === 304) return { data: null, headers: res.headers };
  if (!res.ok) throw await httpError(res);
  return { data: (await res.json()) as T, headers: res.headers };
}

/** REST GET returning rendered HTML (READMEs). Resolves to null on 404. */
export async function restHtml(path: string, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { ...(await authHeaders()), Accept: 'application/vnd.github.html+json' },
    signal,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await httpError(res);
  return res.text();
}

/** A non-2xx response as a GitHubError, with GitHub's message when the body has one. */
async function httpError(res: Response) {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return classify(res, body?.message ?? `GitHub API ${res.status}`);
}

/** Classifies a failure from the response's status and headers, GitHub's message, and GraphQL error types. */
function classify(res: Response, message: string, types: (string | undefined)[] = []): GitHubError {
  const { status, headers } = res;
  if (status === 401) return new GitHubError(message, status, { kind: 'auth' });
  const limited =
    types.includes('RATE_LIMITED') ||
    ((status === 403 || status === 429) &&
      (headers.has('retry-after') || headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(message)));
  if (limited) {
    const until = resetAt(headers);
    return new GitHubError(`GitHub's rate limit for your token is used up until ${formatTime(until)}.`, status, {
      kind: 'rate-limit',
      resetAt: until,
    });
  }
  // REST sends `X-GitHub-SSO: required; url=…`; GraphQL only says so in the message.
  const sso = headers.get('x-github-sso');
  if ((status === 403 && sso) || /SAML/.test(message)) {
    return new GitHubError(message, status, { kind: 'sso', authorizeUrl: sso?.match(/url=(\S+)/)?.[1] });
  }
  if (status === 404 || (types.length && types.every((type) => type === 'NOT_FOUND'))) {
    return new GitHubError(message, status, { kind: 'not-found' });
  }
  return new GitHubError(message, status);
}

/** When a rate limit lifts: `Retry-After` (secondary limits), else `X-RateLimit-Reset`, else in a minute as GitHub advises. */
function resetAt(headers: Headers) {
  const retryAfter = Number(headers.get('retry-after'));
  if (retryAfter > 0) return Date.now() + retryAfter * 1000;
  const reset = Number(headers.get('x-ratelimit-reset')) * 1000;
  return reset > Date.now() ? reset : Date.now() + 60_000;
}
