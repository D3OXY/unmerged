export type PrTab = 'conversation' | 'commits' | 'checks' | 'files';

/** Profile views Unmerged renders; other `?tab=` values (stars, packages…) stay on GitHub. */
export type ProfileTab = 'overview' | 'repositories' | 'achievements' | 'followers' | 'following';

const PROFILE_TABS: readonly string[] = ['overview', 'repositories', 'achievements', 'followers', 'following'] satisfies ProfileTab[];
const isProfileTab = (tab: string): tab is ProfileTab => PROFILE_TABS.includes(tab);

/** Organization lists Unmerged renders (/orgs/<org>/…); teams, projects, settings… stay on GitHub. */
export type OrgTab = 'repositories' | 'people';

/** Which of your pull requests or issues a list shows; GitHub's own path segments (`/pulls/assigned`). */
export type WorkFilter = 'created' | 'assigned' | 'mentioned' | 'review-requested';

/** Repo views Unmerged renders; the other repo tabs (Actions, Settings…) stay on GitHub. */
export type RepoView = 'code' | 'commits' | 'issues' | 'pulls';

export type PrRoute = { kind: 'pr'; owner: string; repo: string; number: number; tab: PrTab };
export type IssueRoute = { kind: 'issue'; owner: string; repo: string; number: number };

/** A pull request or issue open in the side panel next to a list: the list's `?peek=owner/repo/pull/12`. */
export type Peek = PrRoute | IssueRoute;

export type Route =
  | { kind: 'home' }
  | { kind: 'work'; type: 'pr' | 'issue'; filter: WorkFilter; peek?: Peek }
  | { kind: 'notifications' }
  /** A user or an organization: `/<login>` can be either, and only the API knows which. */
  | { kind: 'profile'; login: string; tab: ProfileTab }
  | { kind: 'org'; login: string; tab: OrgTab }
  | PrRoute
  | IssueRoute
  /**
   * A new issue: `/issues/new` (the template chooser or the form, depending on the repo and `search`) and
   * `/issues/new/choose`. `search` is the URL's query (`?template=`, `?title=`…), read by the page.
   */
  | { kind: 'newIssue'; owner: string; repo: string; choose: boolean; search: string }
  /** One commit; `pr` when it was opened from a pull request's commits (/pull/<n>/commits/<sha>). */
  | { kind: 'commit'; owner: string; repo: string; sha: string; pr?: number }
  /**
   * A repo: code browser for /owner/repo, /tree/… and /blob/…, history for /commits/…, and the /issues and
   * /pulls lists. `rest` is "<ref>/<path…>" split on "/" (empty for the lists); branch names can contain
   * slashes, so it's resolved against the repo later (and whether it's a file or folder). Only the lists peek.
   */
  | { kind: 'repo'; owner: string; repo: string; view: RepoView; rest: string[]; peek?: Peek }
  /** A GitHub Actions workflow run (…/actions/runs/<id>), one attempt at it (/attempts/<n>), or one job's logs (/job/<id>). */
  | { kind: 'run'; owner: string; repo: string; runId: number; attempt?: number; job?: number };

// Hex only, so /commit/<sha>.patch and .diff stay GitHub's.
const isSha = (part: string | undefined): part is string => !!part && /^[0-9a-f]{7,40}$/i.test(part);

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
  let parts: string[];
  try {
    parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null; // A malformed `%` escape: GitHub's to deal with.
  }

  if (parts.length === 0) return { kind: 'home' };

  const [first, second, third, fourth, fifth, sixth] = parts;
  if (first === 'notifications' && parts.length === 1) return { kind: 'notifications' };
  if ((first === 'pulls' || first === 'issues') && parts.length <= 2) {
    const filter = (first === 'pulls' ? PULL_FILTERS : ISSUE_FILTERS)[second ?? ''];
    return filter ? { kind: 'work', type: first === 'pulls' ? 'pr' : 'issue', filter, peek: peekOf(url) } : null;
  }
  if (first === 'orgs' && second && (third === 'repositories' || third === 'people') && parts.length === 3) return { kind: 'org', login: second, tab: third };
  if (parts.length === 1 && first && !RESERVED.has(first.toLowerCase())) {
    const tab = url.searchParams.get('tab') || 'overview';
    return isProfileTab(tab) ? { kind: 'profile', login: first, tab } : null;
  }

  if (first && second && !RESERVED.has(first.toLowerCase())) {
    if (parts.length === 2) return { kind: 'repo', owner: first, repo: second, view: 'code', rest: [] };
    if ((third === 'tree' || third === 'blob') && parts.length > 3) return { kind: 'repo', owner: first, repo: second, view: 'code', rest: parts.slice(3) };
    if (third === 'commits') return { kind: 'repo', owner: first, repo: second, view: 'commits', rest: parts.slice(3) };
    if ((third === 'issues' || third === 'pulls') && parts.length === 3) return { kind: 'repo', owner: first, repo: second, view: third, rest: [], peek: peekOf(url) };
    if (third === 'issues' && fourth && /^\d+$/.test(fourth) && parts.length === 4) return { kind: 'issue', owner: first, repo: second, number: Number(fourth) };
    // YAML issue forms (`?template=bug.yml`) stay on GitHub, which renders them.
    if (third === 'issues' && fourth === 'new' && (parts.length === 4 || (parts.length === 5 && fifth === 'choose'))) {
      return /\.ya?ml$/i.test(url.searchParams.get('template') ?? '') ? null : { kind: 'newIssue', owner: first, repo: second, choose: !!fifth, search: url.search };
    }
    if (third === 'commit' && parts.length === 4 && isSha(fourth)) return { kind: 'commit', owner: first, repo: second, sha: fourth };
    if (third === 'actions' && fourth === 'runs' && fifth && /^\d+$/.test(fifth)) {
      const run = { kind: 'run', owner: first, repo: second, runId: Number(fifth) } as const;
      const id = parts[6] && /^\d+$/.test(parts[6]) ? Number(parts[6]) : undefined;
      if (parts.length === 5) return run;
      if (parts.length === 7 && id && sixth === 'job') return { ...run, job: id };
      if (parts.length === 7 && id && sixth === 'attempts') return { ...run, attempt: id };
    }
  }

  if (first && second && third === 'pull' && fourth && /^\d+$/.test(fourth)) {
    if (fifth === 'commits' && parts.length === 6 && isSha(sixth)) return { kind: 'commit', owner: first, repo: second, sha: sixth, pr: Number(fourth) };
    const tab = parts.length === 4 ? 'conversation' : parts.length === 5 && fifth ? PR_TABS[fifth] : undefined;
    if (tab) return { kind: 'pr', owner: first, repo: second, number: Number(fourth), tab };
  }

  return null;
}

/** The pull request or issue a list's `?peek=` opens in its side panel; anything else is ignored. */
function peekOf(url: URL): Peek | undefined {
  const path = url.searchParams.get('peek');
  if (!path) return;
  // Setting the path (never parsing a string) keeps it on github.com, and can't throw.
  const target = new URL(url.origin);
  target.pathname = path;
  const route = matchRoute(target);
  return route?.kind === 'pr' || route?.kind === 'issue' ? route : undefined;
}
