import { isKnownOrg } from './orgs';

export type PrTab = 'conversation' | 'commits' | 'checks' | 'files';

/** Profile views Unmerged renders; other `?tab=` values (repositories, stars…) stay on GitHub. */
export type ProfileTab = 'overview' | 'followers' | 'following';

export type Route =
  | { kind: 'home' }
  | { kind: 'profile'; login: string; tab: ProfileTab }
  | { kind: 'pr'; owner: string; repo: string; number: number; tab: PrTab }
  /**
   * Repo code browser for /owner/repo, /tree/… and /blob/…. `rest` is "<ref>/<path…>" split on "/"; branch
   * names can contain slashes, so it's resolved against the repo later (and whether it's a file or folder).
   */
  | { kind: 'repo'; owner: string; repo: string; rest: string[] };

const PR_TABS: Record<string, PrTab> = { commits: 'commits', checks: 'checks', files: 'files', changes: 'files' };

// First path segments that are GitHub features, not users or organizations.
const RESERVED = new Set([
  'about', 'account', 'apps', 'blog', 'codespaces', 'collections', 'contact', 'copilot', 'customer-stories',
  'dashboard', 'discussions', 'enterprise', 'events', 'explore', 'features', 'feed', 'github-copilot', 'home',
  'issues', 'join', 'login', 'logout', 'marketplace', 'mobile', 'models', 'new', 'nonprofit', 'notifications',
  'open-source', 'organizations', 'orgs', 'partners', 'password_reset', 'pricing', 'pulls', 'readme', 'repos',
  'repositories', 'resources', 'search', 'security', 'sessions', 'settings', 'signup', 'site', 'solutions',
  'sponsors', 'stars', 'team', 'topics', 'trending', 'users', 'watching', 'premium-support', 'education',
]);

/** Maps a github.com URL to the Unmerged page that owns it, or null to leave GitHub alone. */
export function matchRoute(url: URL): Route | null {
  if (url.hostname !== 'github.com') return null;
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (parts.length === 0) return { kind: 'home' };

  const [first, second, third, fourth, fifth] = parts;
  if (parts.length === 1 && first && !RESERVED.has(first.toLowerCase()) && !isKnownOrg(first)) {
    const tab = url.searchParams.get('tab') || 'overview';
    return tab === 'overview' || tab === 'followers' || tab === 'following' ? { kind: 'profile', login: first, tab } : null;
  }

  if (first && second && !RESERVED.has(first.toLowerCase())) {
    if (parts.length === 2) return { kind: 'repo', owner: first, repo: second, rest: [] };
    if ((third === 'tree' || third === 'blob') && parts.length > 3) return { kind: 'repo', owner: first, repo: second, rest: parts.slice(3) };
  }

  if (first && second && third === 'pull' && fourth && /^\d+$/.test(fourth)) {
    const tab = parts.length === 4 ? 'conversation' : parts.length === 5 && fifth ? PR_TABS[fifth] : undefined;
    if (tab) return { kind: 'pr', owner: first, repo: second, number: Number(fourth), tab };
  }

  return null;
}
