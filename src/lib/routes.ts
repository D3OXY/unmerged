import { isKnownOrg } from './orgs';

export type PrTab = 'conversation' | 'commits' | 'checks' | 'files';

/** Profile views Unmerged renders; other `?tab=` values (stars, packages…) stay on GitHub. */
export type ProfileTab = 'overview' | 'repositories' | 'achievements' | 'followers' | 'following';

const PROFILE_TABS: readonly string[] = ['overview', 'repositories', 'achievements', 'followers', 'following'] satisfies ProfileTab[];
const isProfileTab = (tab: string): tab is ProfileTab => PROFILE_TABS.includes(tab);

/** Which of your pull requests or issues a list shows; GitHub's own path segments (`/pulls/assigned`). */
export type WorkFilter = 'created' | 'assigned' | 'mentioned' | 'review-requested';

export type RepoView = 'code' | 'commits';

export type Route =
  | { kind: 'home' }
  | { kind: 'work'; type: 'pr' | 'issue'; filter: WorkFilter }
  | { kind: 'notifications' }
  | { kind: 'profile'; login: string; tab: ProfileTab }
  | { kind: 'pr'; owner: string; repo: string; number: number; tab: PrTab }
  /**
   * Repo code browser for /owner/repo, /tree/… and /blob/…, and its history for /commits/…. `rest` is
   * "<ref>/<path…>" split on "/"; branch names can contain slashes, so it's resolved against the repo later
   * (and whether it's a file or folder).
   */
  | { kind: 'repo'; owner: string; repo: string; view: RepoView; rest: string[] };

const PR_TABS: Record<string, PrTab> = { commits: 'commits', checks: 'checks', files: 'files', changes: 'files' };

// `/pulls` and `/issues` alone list what you created.
const PULL_FILTERS: Record<string, WorkFilter> = { '': 'created', assigned: 'assigned', mentioned: 'mentioned', 'review-requested': 'review-requested' };
const ISSUE_FILTERS: Record<string, WorkFilter> = { '': 'created', created: 'created', assigned: 'assigned', mentioned: 'mentioned' };

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
  if (first === 'notifications' && parts.length === 1) return { kind: 'notifications' };
  if ((first === 'pulls' || first === 'issues') && parts.length <= 2) {
    const filter = (first === 'pulls' ? PULL_FILTERS : ISSUE_FILTERS)[second ?? ''];
    return filter ? { kind: 'work', type: first === 'pulls' ? 'pr' : 'issue', filter } : null;
  }
  if (parts.length === 1 && first && !RESERVED.has(first.toLowerCase()) && !isKnownOrg(first)) {
    const tab = url.searchParams.get('tab') || 'overview';
    return isProfileTab(tab) ? { kind: 'profile', login: first, tab } : null;
  }

  if (first && second && !RESERVED.has(first.toLowerCase())) {
    if (parts.length === 2) return { kind: 'repo', owner: first, repo: second, view: 'code', rest: [] };
    if ((third === 'tree' || third === 'blob') && parts.length > 3) return { kind: 'repo', owner: first, repo: second, view: 'code', rest: parts.slice(3) };
    if (third === 'commits') return { kind: 'repo', owner: first, repo: second, view: 'commits', rest: parts.slice(3) };
  }

  if (first && second && third === 'pull' && fourth && /^\d+$/.test(fourth)) {
    const tab = parts.length === 4 ? 'conversation' : parts.length === 5 && fifth ? PR_TABS[fifth] : undefined;
    if (tab) return { kind: 'pr', owner: first, repo: second, number: Number(fourth), tab };
  }

  return null;
}
