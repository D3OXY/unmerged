export type PrTab = 'conversation' | 'commits' | 'checks' | 'files';

/** Profile views Unmerged renders; other `?tab=` values (stars, packages…) stay on GitHub. */
export type ProfileTab = 'overview' | 'repositories' | 'achievements' | 'followers' | 'following';

const PROFILE_TABS: readonly string[] = ['overview', 'repositories', 'achievements', 'followers', 'following'] satisfies ProfileTab[];
const isProfileTab = (tab: string): tab is ProfileTab => PROFILE_TABS.includes(tab);

/** Organization lists Unmerged renders (/orgs/<org>/…); teams, projects, settings… stay on GitHub. */
export type OrgTab = 'repositories' | 'people';

/** A repo's branch lists (/branches/<tab>); GitHub's own path segments, `overview` for /branches alone. */
export type BranchesTab = 'overview' | 'yours' | 'active' | 'stale' | 'all';

const BRANCHES_TABS: readonly string[] = ['yours', 'active', 'stale', 'all'] satisfies BranchesTab[];
const isBranchesTab = (tab: string): tab is BranchesTab => BRANCHES_TABS.includes(tab);

/** Which of your pull requests or issues a list shows; GitHub's own path segments (`/pulls/assigned`). */
export type WorkFilter = 'created' | 'assigned' | 'mentioned' | 'review-requested';

/** GitHub's search tabs (its `?type=` values) that Unmerged renders; discussions, topics, wikis… stay on GitHub. */
export const SEARCH_TYPES = ['repositories', 'code', 'issues', 'pullrequests', 'users', 'commits'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
const isSearchType = (type: string): type is SearchType => (SEARCH_TYPES as readonly string[]).includes(type);

/** Repo views Unmerged renders; the other repo tabs (Settings…) stay on GitHub. */
export type RepoView = 'code' | 'commits' | 'issues' | 'pulls';

/**
 * `range`: Files changed for some of the commits, as GitHub's URLs say it (/files/<range>): "<sha>" for one commit,
 * "<base>..<head>" for the changes from commit `base` to commit `head`.
 */
export type PrRoute = { kind: 'pr'; owner: string; repo: string; number: number; tab: PrTab; range?: string };
export type IssueRoute = { kind: 'issue'; owner: string; repo: string; number: number };

/**
 * Two refs compared (/compare/<base>...<head>), and with `expand` (`?expand=1`) the form that opens a pull
 * request from them. No `base` is the default branch; no `head`, nothing chosen yet. A head in a fork is
 * "owner:branch" or "owner:repo:branch".
 */
export type CompareRoute = { kind: 'compare'; owner: string; repo: string; base?: string; head?: string; expand: boolean };

/** A pull request or issue open in the side panel next to a list: the list's `?peek=owner/repo/pull/12`. */
export type Peek = PrRoute | IssueRoute;

export type Route =
  | { kind: 'home' }
  | { kind: 'work'; type: 'pr' | 'issue'; filter: WorkFilter; peek?: Peek }
  | { kind: 'notifications' }
  /** GitHub search. `sort` is GitHub's `?s=` and `?o=` as one ("stars-desc"), '' for best match. */
  | { kind: 'search'; q: string; type: SearchType; sort: string }
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
  | CompareRoute
  /** One commit; `pr` when it was opened from a pull request's commits (/pull/<n>/commits/<sha>). */
  | { kind: 'commit'; owner: string; repo: string; sha: string; pr?: number }
  /**
   * A repo: code browser for /owner/repo, /tree/… and /blob/…, history for /commits/…, and the /issues and
   * /pulls lists. `rest` is "<ref>/<path…>" split on "/" (empty for the lists); branch names can contain
   * slashes, so it's resolved against the repo later (and whether it's a file or folder). Only the lists peek.
   */
  | { kind: 'repo'; owner: string; repo: string; view: RepoView; rest: string[]; peek?: Peek }
  /**
   * A repo's workflow runs (/actions), or one workflow's (/actions/workflows/<file>). `workflow` is GitHub's path
   * segment: the file name, or for a dynamic workflow (Pages, Dependabot) "pages/pages-build-deployment".
   * `?query=` is read by the page.
   */
  | { kind: 'actions'; owner: string; repo: string; workflow?: string }
  /** A GitHub Actions workflow run (…/actions/runs/<id>), one attempt at it (/attempts/<n>), or one job's logs (/job/<id>). */
  | { kind: 'run'; owner: string; repo: string; runId: number; attempt?: number; job?: number }
  /** A repo's branches: the overview (/branches) or one list (/branches/yours…). `?query=` is read by the page. */
  | { kind: 'branches'; owner: string; repo: string; tab: BranchesTab }
  /** A repo's contributors graph (/graphs/contributors). Other Insights graphs stay on GitHub. */
  | { kind: 'contributors'; owner: string; repo: string }
  /** A repo's releases (/releases) or tags (/tags): one page, a tab each. */
  | { kind: 'releases'; owner: string; repo: string; tab: 'releases' | 'tags' }
  /**
   * One release (/releases/tag/<tag>), or with no `tag` the latest (/releases/latest). Tags can contain slashes. A
   * tag without a release shows the tag, as GitHub's page does.
   */
  | { kind: 'release'; owner: string; repo: string; tag?: string };

// Hex only, so /commit/<sha>.patch and .diff stay GitHub's. No upper bound, as the boot rules (bootRules.ts) can't
// afford one.
const isSha = (part: string | undefined): part is string => !!part && /^[0-9a-f]{7,}$/i.test(part);

const PR_TABS: Record<string, PrTab> = { commits: 'commits', checks: 'checks', files: 'files', changes: 'files' };

// `/pulls` and `/issues` alone list what you created.
const PULL_FILTERS: Record<string, WorkFilter> = { '': 'created', assigned: 'assigned', mentioned: 'mentioned', 'review-requested': 'review-requested' };
const ISSUE_FILTERS: Record<string, WorkFilter> = { '': 'created', created: 'created', assigned: 'assigned', mentioned: 'mentioned' };

// First path segments that are GitHub features, not users or organizations.
export const RESERVED = new Set([
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
  if (first === 'search' && parts.length === 1) return searchRoute(url);
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
    if (third === 'actions' && parts.length === 3) return { kind: 'actions', owner: first, repo: second };
    // A dynamic workflow's folder has no dot, so a file's badge (/workflows/ci.yml/badge.svg) stays GitHub's.
    if (third === 'actions' && fourth === 'workflows' && fifth && (parts.length === 5 || (parts.length === 6 && !fifth.includes('.')))) {
      return { kind: 'actions', owner: first, repo: second, workflow: parts.slice(4).join('/') };
    }
    if (third === 'actions' && fourth === 'runs' && fifth && /^\d+$/.test(fifth)) {
      const run = { kind: 'run', owner: first, repo: second, runId: Number(fifth) } as const;
      const id = parts[6] && /^\d+$/.test(parts[6]) ? Number(parts[6]) : undefined;
      if (parts.length === 5) return run;
      if (parts.length === 7 && id && sixth === 'job') return { ...run, job: id };
      if (parts.length === 7 && id && sixth === 'attempts') return { ...run, attempt: id };
    }
    if (third === 'branches' && parts.length === 3) return { kind: 'branches', owner: first, repo: second, tab: 'overview' };
    if (third === 'branches' && parts.length === 4 && fourth && isBranchesTab(fourth)) return { kind: 'branches', owner: first, repo: second, tab: fourth };
    if (third === 'graphs' && fourth === 'contributors' && parts.length === 4) return { kind: 'contributors', owner: first, repo: second };
    // GitHub's release search (`?q=`) stays GitHub's.
    if ((third === 'releases' || third === 'tags') && parts.length === 3 && !url.searchParams.has('q')) return { kind: 'releases', owner: first, repo: second, tab: third };
    if (third === 'releases' && fourth === 'latest' && parts.length === 4) return { kind: 'release', owner: first, repo: second };
    // A draft has no tag yet: its page (/releases/tag/untagged-<id>) stays GitHub's.
    if (third === 'releases' && fourth === 'tag' && fifth && !fifth.startsWith('untagged-')) return { kind: 'release', owner: first, repo: second, tag: parts.slice(4).join('/') };
    if (third === 'compare') return compareRoute(first, second, parts.slice(3).join('/'), url);
    if (third === 'search' && parts.length === 3) return searchRoute(url, `${first}/${second}`);
  }

  if (first && second && third === 'pull' && fourth && /^\d+$/.test(fourth)) {
    if (fifth === 'commits' && parts.length === 6 && isSha(sixth)) return { kind: 'commit', owner: first, repo: second, sha: sixth, pr: Number(fourth) };
    const tab = parts.length === 4 ? 'conversation' : parts.length === 5 && fifth ? PR_TABS[fifth] : undefined;
    if (tab) return { kind: 'pr', owner: first, repo: second, number: Number(fourth), tab };
    if ((fifth === 'files' || fifth === 'changes') && parts.length === 6 && sixth && /^[0-9a-f]{7,}(?:\.\.[0-9a-f]{7,})?$/i.test(sixth)) {
      return { kind: 'pr', owner: first, repo: second, number: Number(fourth), tab: 'files', range: sixth };
    }
  }

  return null;
}

/**
 * A compare spec, "<base>...<head>" or "<head>" alone. Refs can hold slashes (rejoined above) but never "..",
 * so the dots split it unambiguously. Left to GitHub: two-dot specs (the API only diffs from the merge base),
 * .diff/.patch views, and a base in another repo (GitHub moves to that repo's page).
 */
function compareRoute(owner: string, repo: string, spec: string, url: URL): CompareRoute | null {
  const expand = url.searchParams.get('expand') === '1';
  if (!spec) return { kind: 'compare', owner, repo, expand };
  const dots = spec.indexOf('...');
  const base = dots === -1 ? undefined : spec.slice(0, dots);
  const head = dots === -1 ? spec : spec.slice(dots + 3);
  if (base === '' || base?.includes(':') || !head || head.includes('..') || /\.(diff|patch)$/.test(head)) return null;
  return { kind: 'compare', owner, repo, base, head, expand };
}

/**
 * `/search?q=…&type=…&s=…&o=…`. A repo's own search (`/owner/repo/search`, `repo` "owner/name") is the same
 * search with `repo:owner/name` in front, defaulting to code as GitHub's does. Old capitalized types still work.
 */
function searchRoute(url: URL, repo?: string): Route | null {
  const params = url.searchParams;
  const type = params.get('type')?.toLowerCase() || (repo ? 'code' : 'repositories');
  if (!isSearchType(type)) return null;
  const q = params.get('q')?.trim() ?? '';
  const s = params.get('s');
  return { kind: 'search', q: repo ? `repo:${repo} ${q}`.trim() : q, type, sort: s ? `${s}-${params.get('o') === 'asc' ? 'asc' : 'desc'}` : '' };
}

/** The pull request or issue a list's `?peek=` opens in its side panel; anything else is ignored. */
function peekOf(url: URL): Peek | undefined {
  const path = url.searchParams.get('peek');
  if (!path) return;
  // Setting the path (never parsing a string) keeps it on github.com, and can't throw.
  const target = new URL(url.origin);
  target.pathname = path;
  return peekAt(target);
}

/** The pull request or issue page `url` is, as something a side panel can show; anything else is undefined. */
export function peekAt(url: URL): Peek | undefined {
  const route = matchRoute(url);
  return route?.kind === 'pr' || route?.kind === 'issue' ? route : undefined;
}
