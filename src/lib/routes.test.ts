import { describe, expect, it } from 'vitest';
import { rememberOrgs } from './orgs';
import { matchRoute, type PrTab, type RepoView, type Route } from './routes';

const repo = (view: RepoView, rest: string[] = []): Route => ({ kind: 'repo', owner: 'o', repo: 'r', view, rest });
const pr = (tab: PrTab): Route => ({ kind: 'pr', owner: 'o', repo: 'r', number: 12, tab });

describe('matchRoute', () => {
  rememberOrgs(['Vercel']);

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

    // Reserved first segments are GitHub features, never profiles or repos
    ['https://github.com/settings', null],
    ['https://github.com/Settings', null],
    ['https://github.com/settings/profile', null],
    ['https://github.com/marketplace/actions', null],
    ['https://github.com/orgs/acme/people', null],

    // Profiles, and orgs we've learned about
    ['https://github.com/octocat', { kind: 'profile', login: 'octocat', tab: 'overview' }],
    ['https://github.com/octocat/', { kind: 'profile', login: 'octocat', tab: 'overview' }],
    ['https://github.com/octocat?tab=', { kind: 'profile', login: 'octocat', tab: 'overview' }],
    ['https://github.com/octocat?tab=repositories', { kind: 'profile', login: 'octocat', tab: 'repositories' }],
    ['https://github.com/octocat?tab=stars', null],
    ['https://github.com/vercel', null],
    ['https://github.com/VERCEL', null],

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
    ['https://github.com/o/r/actions', null],
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
    ['https://github.com/o/r/issues/new', null],
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
