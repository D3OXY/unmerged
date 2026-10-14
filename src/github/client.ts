import { tokenItem } from '@/lib/settings';

/** Thrown when the token is missing or GitHub rejects it, so the UI can ask for a new one. */
export class AuthError extends Error {}

type GraphQLResponse<T> = { data?: T; errors?: { message: string; type?: string }[] };

async function authHeaders(): Promise<HeadersInit> {
  const token = await tokenItem.getValue();
  if (!token) throw new AuthError('No GitHub token configured');
  return { Authorization: `Bearer ${token}` };
}

/**
 * Runs a GitHub GraphQL query. `allowPartial` returns whatever data came back even when
 * some fields errored (e.g. `user(login:)` on an organization resolves to null with an error).
 */
export async function gql<T>(query: string, variables: Record<string, unknown> = {}, allowPartial = false): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) throw new AuthError('GitHub rejected the token');
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length && !(allowPartial && json.data)) {
    throw new Error(json.errors.map((e) => e.message).join('\n'));
  }
  if (!json.data) throw new Error('GitHub returned no data');
  return json.data;
}

/** REST call returning JSON. GitHub's error message is surfaced as the thrown error. */
export async function rest<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method: init.method ?? 'GET',
    headers: { ...(await authHeaders()), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 401) throw new AuthError('GitHub rejected the token');
  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? `GitHub API ${res.status}`);
  }
  const text = await res.text(); // Some endpoints (re-runs) answer with an empty body.
  return (text ? JSON.parse(text) : undefined) as T;
}

/** REST GET returning rendered HTML (READMEs). Resolves to null on 404. */
export async function restHtml(path: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { ...(await authHeaders()), Accept: 'application/vnd.github.html+json' },
  });
  if (res.status === 404) return null;
  if (res.status === 401) throw new AuthError('GitHub rejected the token');
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.text();
}
