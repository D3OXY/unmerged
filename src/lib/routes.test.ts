import { describe, expect, it } from 'vitest';
import { matchRoute, type PrTab, type RepoView, type Route } from './routes';

const repo = (view: RepoView, rest: string[] = []): Route => ({ kind: 'repo', owner: 'o', repo: 'r', view, rest });
const pr = (tab: PrTab): Route => ({ kind: 'pr', owner: 'o', repo: 'r', number: 12, tab });
const compare = (spec: { base?: string; head?: string; expand?: boolean }): Route => ({ kind: 'compare', owner: 'o', repo: 'r', expand: false, ...spec });

describe('matchRoute', () => {
  it.each<[string, Route | null]>([
    // Home and other hosts
    ['https://github.com/', { kind: 'home' }],
    ['https://github.com/?tab=x', { kind: 'home' }],
    ['https://gist.github.com/', null],

    // Top-level lists
    ['https://github.com/notifications', { kind: 'notifications' }],
    ['https://github.com/notifications/subscriptions', null],
    ['https://github.com/pulls', { kind: 'work', type: 'pr', filter: 'created' }],
    ['https://github.com/pulls/', { kind: 'work', type: 'pr', filter: 'created' }],
    ['https://github.com/pulls/assigned', { kind: 'work', type: 'pr', filter: 'assigned' }],
    ['https://github.com/pulls/review-requested?q=is:open', { kind: 'work', type: 'pr', filter: 'review-requested' }],
    ['https://github.com/pulls/unknown', null],
    ['https://github.com/issues', { kind: 'work', type: 'issue', filter: 'created' }],
    ['https://github.com/issues/created', { kind: 'work', type: 'issue', filter: 'created' }],
    ['https://github.com/issues/mentioned', { kind: 'work', type: 'issue', filter: 'mentioned' }],
    ['https://github.com/issues/review-requested', null],
    ['https://github.com/pulls/assigned/more', null],

    // Search: GitHub's own `type` values, its `s`/`o` sort, and a repo's search as `repo:` in the query
    ['https://github.com/search?q=react+hooks&type=repositories', { kind: 'search', q: 'react hooks', type: 'repositories', sort: '' }],
    ['https://github.com/search?q=x', { kind: 'search', q: 'x', type: 'repositories', sort: '' }],
    ['https://github.com/search', { kind: 'search', q: '', type: 'repositories', sort: '' }],
    ['https://github.com/search?q=x&type=Code', { kind: 'search', q: 'x', type: 'code', sort: '' }],
    ['https://github.com/search?q=x&type=pullrequests&s=created&o=asc', { kind: 'search', q: 'x', type: 'pullrequests', sort: 'created-asc' }],
    ['https://github.com/search?q=x&type=commits&s=author-date', { kind: 'search', q: 'x', type: 'commits', sort: 'author-date-desc' }],
    ['https://github.com/search?q=x&type=discussions', null],
    ['https://github.com/search/advanced', null],
    ['https://github.com/o/r/search?q=useState', { kind: 'search', q: 'repo:o/r useState', type: 'code', sort: '' }],
    ['https://github.com/o/r/search?q=bug&type=issues', { kind: 'search', q: 'repo:o/r bug', type: 'issues', sort: '' }],
    ['https://github.com/o/r/search/x', null],

    // Reserved first segments are GitHub features, never profiles or repos
    ['https://github.com/settings', null],
    ['https://github.com/Settings', null],
    ['https://github.com/settings/profile', null],
    ['https://github.com/marketplace/actions', null],
    ['https://github.com/orgs', null],
    ['https://github.com/orgs/acme', null],
    ['https://github.com/orgs/acme/teams', null],

    // Profiles (users and organizations alike)
    ['https://github.com/octocat', { kind: 'profile', login: 'octocat', tab: 'overview' }],
    ['https://github.com/octocat/', { kind: 'profile', login: 'octocat', tab: 'overview' }],
    ['https://github.com/octocat?tab=', { kind: 'profile', login: 'octocat', tab: 'overview' }],
    ['https://github.com/octocat?tab=repositories', { kind: 'profile', login: 'octocat', tab: 'repositories' }],
    ['https://github.com/octocat?tab=stars', null],
    ['https://github.com/vercel', { kind: 'profile', login: 'vercel', tab: 'overview' }],

    // Organization lists
    ['https://github.com/orgs/acme/repositories?q=x&sort=name', { kind: 'org', login: 'acme', tab: 'repositories' }],
    ['https://github.com/orgs/Acme/people', { kind: 'org', login: 'Acme', tab: 'people' }],
    ['https://github.com/orgs/acme/people/', { kind: 'org', login: 'acme', tab: 'people' }],
    ['https://github.com/orgs/acme/people/octocat', null],

    // Repo views
    ['https://github.com/o/r', repo('code')],
    ['https://github.com/o/r/', repo('code')],
    ['https://github.com/vercel/next.js', { kind: 'repo', owner: 'vercel', repo: 'next.js', view: 'code', rest: [] }],
    ['https://github.com/o/r/tree/main', repo('code', ['main'])],
    ['https://github.com/o/r/tree/feature/x/src', repo('code', ['feature', 'x', 'src'])],
    ['https://github.com/o/r/blob/main/a%20b.md', repo('code', ['main', 'a b.md'])],
    ['https://github.com/o/r/tree', null],
    ['https://github.com/o/r/commits', repo('commits')],
    ['https://github.com/o/r/commits/main/src', repo('commits', ['main', 'src'])],
    ['https://github.com/o/r/issues', repo('issues')],
    ['https://github.com/o/r/pulls?q=is:closed', repo('pulls')],
    ['https://github.com/Owner/Repo', { kind: 'repo', owner: 'Owner', repo: 'Repo', view: 'code', rest: [] }],

    // Pull requests and their tab aliases
    ['https://github.com/o/r/pull/12', pr('conversation')],
    ['https://github.com/o/r/pull/12/', pr('conversation')],
    ['https://github.com/o/r/pull/12/commits', pr('commits')],
    ['https://github.com/o/r/pull/12/checks', pr('checks')],
    ['https://github.com/o/r/pull/12/files', pr('files')],
    ['https://github.com/o/r/pull/12/changes', pr('files')],
    ['https://github.com/o/r/pull/12/unknown', null],
    ['https://github.com/o/r/pull/new', null],

    // Issues
    ['https://github.com/o/r/issues/123', { kind: 'issue', owner: 'o', repo: 'r', number: 123 }],
    ['https://github.com/o/r/issues/new', { kind: 'newIssue', owner: 'o', repo: 'r', choose: false, search: '' }],
    ['https://github.com/o/r/issues/new?template=bug.md&title=Hi', { kind: 'newIssue', owner: 'o', repo: 'r', choose: false, search: '?template=bug.md&title=Hi' }],
    ['https://github.com/o/r/issues/new/choose', { kind: 'newIssue', owner: 'o', repo: 'r', choose: true, search: '' }],
    // YAML issue forms are GitHub's
    ['https://github.com/o/r/issues/new?template=bug.yml', null],
    ['https://github.com/o/r/issues/new?template=Bug.YAML', null],
    ['https://github.com/o/r/issues/new/other', null],
    ['https://github.com/o/r/issues/12/edit', null],
    // Commits: hex SHAs of 7–40 characters only, so raw views, checks and branch names stay GitHub's
    ['https://github.com/o/r/commit/20adf3c', { kind: 'commit', owner: 'o', repo: 'r', sha: '20adf3c' }],
    ['https://github.com/o/r/pull/12/commits/abcdef1', { kind: 'commit', owner: 'o', repo: 'r', sha: 'abcdef1', pr: 12 }],
    ['https://github.com/o/r/commit/abc123', null],
    ['https://github.com/o/r/commit/20adf3c.patch', null],
    ['https://github.com/o/r/commit/20adf3c.diff', null],
    ['https://github.com/o/r/commit/20adf3c/checks', null],
    ['https://github.com/o/r/commit/main', null],
    ['https://github.com/o/r/pull/12/commits/abc123', null],

    // The Actions list, one workflow's runs (a dynamic workflow's in two segments), workflow runs, their attempts
    // and jobs; badges, settings and other run views stay GitHub's
    ['https://github.com/o/r/actions', { kind: 'actions', owner: 'o', repo: 'r' }],
    ['https://github.com/o/r/actions?query=is:failure', { kind: 'actions', owner: 'o', repo: 'r' }],
    ['https://github.com/o/r/actions/workflows/ci.yml', { kind: 'actions', owner: 'o', repo: 'r', workflow: 'ci.yml' }],
    ['https://github.com/o/r/actions/workflows/pages/pages-build-deployment', { kind: 'actions', owner: 'o', repo: 'r', workflow: 'pages/pages-build-deployment' }],
    ['https://github.com/o/r/actions/workflows/ci.yml/badge.svg', null],
    ['https://github.com/o/r/actions/workflows', null],
    ['https://github.com/o/r/actions/new', null],
    ['https://github.com/o/r/actions/runs/39012435752', { kind: 'run', owner: 'o', repo: 'r', runId: 39012435752 }],
    ['https://github.com/o/r/actions/runs/39012435752/job/117337646346', { kind: 'run', owner: 'o', repo: 'r', runId: 39012435752, job: 117337646346 }],
    ['https://github.com/o/r/actions/runs/39012435752/attempts/2', { kind: 'run', owner: 'o', repo: 'r', runId: 39012435752, attempt: 2 }],
    ['https://github.com/o/r/actions/runs/39012435752/job/abc', null],
    ['https://github.com/o/r/actions/runs/39012435752/attempts/2/job/1', null],
    ['https://github.com/o/r/actions/runs/39012435752/workflow', null],
    ['https://github.com/o/r/actions/runs/39012435752/usage', null],
    ['https://github.com/o/r/actions/runs', null],

    // Branches: the overview and GitHub's four lists; any other segment stays GitHub's
    ['https://github.com/o/r/branches', { kind: 'branches', owner: 'o', repo: 'r', tab: 'overview' }],
    ['https://github.com/o/r/branches?query=fix', { kind: 'branches', owner: 'o', repo: 'r', tab: 'overview' }],
    ['https://github.com/o/r/branches/stale', { kind: 'branches', owner: 'o', repo: 'r', tab: 'stale' }],
    ['https://github.com/o/r/branches/all', { kind: 'branches', owner: 'o', repo: 'r', tab: 'all' }],
    ['https://github.com/o/r/branches/overview', null],
    ['https://github.com/o/r/branches/all/more', null],

    // Contributors is the one Insights graph we own
    ['https://github.com/o/r/graphs/contributors', { kind: 'contributors', owner: 'o', repo: 'r' }],
    ['https://github.com/o/r/graphs/commit-activity', null],
    ['https://github.com/o/r/graphs/contributors/more', null],

    // Releases and tags, one release (tags can hold slashes) and the latest; search, drafts and forms stay GitHub's
    ['https://github.com/o/r/releases', { kind: 'releases', owner: 'o', repo: 'r', tab: 'releases' }],
    ['https://github.com/o/r/tags', { kind: 'releases', owner: 'o', repo: 'r', tab: 'tags' }],
    ['https://github.com/o/r/releases?q=fix', null],
    ['https://github.com/o/r/releases/tag/v1.2.0', { kind: 'release', owner: 'o', repo: 'r', tag: 'v1.2.0' }],
    ['https://github.com/o/r/releases/tag/app/v1', { kind: 'release', owner: 'o', repo: 'r', tag: 'app/v1' }],
    ['https://github.com/o/r/releases/latest', { kind: 'release', owner: 'o', repo: 'r' }],
    ['https://github.com/o/r/releases/tag/untagged-1a2b3c', null],
    ['https://github.com/o/r/releases/new', null],
    ['https://github.com/o/r/releases/edit/v1.2.0', null],
    ['https://github.com/o/r/releases/download/v1.2.0/app.zip', null],

    // Compare: three dots split base from head; slashes stay in the ref, a fork's head keeps its owner
    ['https://github.com/o/r/compare', compare({})],
    ['https://github.com/o/r/compare?expand=1', compare({ expand: true })],
    ['https://github.com/o/r/compare/main...feature', compare({ base: 'main', head: 'feature' })],
    ['https://github.com/o/r/compare/release/1.x...fix/a/b?expand=1', compare({ base: 'release/1.x', head: 'fix/a/b', expand: true })],
    ['https://github.com/o/r/compare/feature/x', compare({ head: 'feature/x' })],
    ['https://github.com/o/r/compare/main...user:feature/x', compare({ base: 'main', head: 'user:feature/x' })],
    ['https://github.com/o/r/compare/main...user:fork:feature', compare({ base: 'main', head: 'user:fork:feature' })],
    ['https://github.com/o/r/compare/v1.2...v1.3', compare({ base: 'v1.2', head: 'v1.3' })],
    ['https://github.com/o/r/compare/main...a%23b', compare({ base: 'main', head: 'a#b' })],
    ['https://github.com/o/r/compare/main..feature', null],
    ['https://github.com/o/r/compare/main...feature.diff', null],
    ['https://github.com/o/r/compare/upstream:main...feature', null],
    ['https://github.com/o/r/compare/...feature', null],
    ['https://github.com/o/r/compare/main...', null],

    // Lists with a pull request or issue in the side panel; any other `?peek=` is ignored
    ['https://github.com/o/r/issues?peek=o%2Fr%2Fissues%2F123', { kind: 'repo', owner: 'o', repo: 'r', view: 'issues', rest: [], peek: { kind: 'issue', owner: 'o', repo: 'r', number: 123 } }],
    ['https://github.com/pulls?peek=o/r/pull/12/files', { kind: 'work', type: 'pr', filter: 'created', peek: { kind: 'pr', owner: 'o', repo: 'r', number: 12, tab: 'files' } }],
    ['https://github.com/o/r/issues?peek=o/r', repo('issues')],
    ['https://github.com/o/r/issues?peek=//evil.com/o/r/issues/1', repo('issues')],
    ['https://github.com/o/r/pull/12?peek=o/r/issues/1', pr('conversation')],

    // Malformed escapes are left to GitHub instead of throwing
    ['https://github.com/%E0%A4%A', null],
    ['https://github.com/o/r/blob/main/100%', null],
  ])('%s', (url, expected) => {
    expect(matchRoute(new URL(url))).toEqual(expected);
  });
});
