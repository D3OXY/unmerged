import { describe, expect, it } from 'vitest';
import { bootTarget } from './boot';
import { bootRules } from './bootRules';
import { matchRoute } from './routes';
import { DEFAULT_SURFACES, surfaceOf, type Surface } from './settings';

/** What the browser does with a GET of `url` under `rules`: the boot URL it redirects to, or null. */
function evaluate(rules: ReturnType<typeof bootRules>) {
  const compiled = rules.map(({ priority = 1, action, condition }) => ({
    priority,
    action,
    regex: new RegExp(condition.regexFilter!, condition.isUrlFilterCaseSensitive === false ? 'i' : ''),
  }));
  return (url: string) => {
    const matched = compiled.filter(({ regex }) => regex.test(url));
    const top = Math.max(...matched.map(({ priority }) => priority));
    const winners = matched.filter(({ priority }) => priority === top);
    const redirect = winners.find(({ action }) => action.type === 'redirect');
    if (!redirect || winners.some(({ action }) => action.type === 'allow')) return null;
    return url.replace(redirect.regex, redirect.action.redirect!.regexSubstitution!.replace('\\1', '$1'));
  };
}

const allOn = evaluate(bootRules(DEFAULT_SURFACES));
const withOff = Object.fromEntries(
  Object.keys(DEFAULT_SURFACES).map((surface) => [surface, evaluate(bootRules({ ...DEFAULT_SURFACES, [surface]: false }))]),
) as Record<Surface, (url: string) => string | null>;

// Loads that should start on the boot page: at least one per route kind.
const BOOTED = [
  '/',
  '/?tab=x',
  '/notifications',
  '/notifications?query=reason:mention',
  '/pulls',
  '/pulls/review-requested?q=is:open',
  '/issues/assigned',
  '/search?q=react+hooks&type=repositories',
  '/search?type=code&q=useState&p=2',
  '/orgs/acme/repositories?q=x&sort=name',
  '/octocat',
  '/octocat?tab=repositories',
  '/vercel/next.js',
  '/o/r/',
  '/o/r/tree/feature/x/src',
  '/o/r/blob/main/a%20b.md',
  '/o/r/commits/main',
  '/o/r/issues?q=is:open',
  '/o/r/pulls?peek=o%2Fr%2Fpull%2F12',
  '/TanStack/query/pull/12030',
  '/oven-sh/bun/pull/30412/files',
  '/o/r/pull/12/changes',
  '/o/r/issues/1657',
  '/o/r/issues/new?template=bug.md&title=Hi',
  '/o/r/issues/new/choose',
  '/o/r/compare',
  '/o/r/compare/v1.2...v1.3',
  '/o/r/compare/main...feature/x?expand=1',
  '/o/r/commit/20adf3c',
  '/o/r/pull/12/commits/abcdef1',
  '/o/r/search?q=useState',
  '/o/r/actions?query=is:failure',
  '/o/r/actions/workflows/ci.yml',
  '/o/r/actions/workflows/pages/pages-build-deployment',
  '/o/r/actions/runs/39012435752/job/117337646346',
  '/o/r/branches/stale',
  '/o/r/graphs/contributors',
  '/o/r/tags',
  '/o/r/releases/latest',
  '/o/r/releases/tag/app/v1.2.0',
];

// Segments and queries that sit on the edges of `matchRoute`, mixed into the URLs above.
const SEGMENTS = [
  ...['settings', 'Settings', 'site', 'orgs', 'issues', 'pulls', 'pull', 'search', 'notifications', 'new', 'choose', 'edit'],
  ...['tree', 'blob', 'commits', 'commit', 'actions', 'workflows', 'runs', 'job', 'attempts', 'usage', 'branches', 'yours', 'overview'],
  ...['graphs', 'contributors', 'releases', 'tags', 'tag', 'latest', 'untagged-1a2b', '%75ntagged-1', 'compare', 'main...dev', 'main..dev'],
  ...['a:b...c', '...dev', 'main...', 'x.diff', 'v1.2.patch', 'ci.yml', 'badge.svg', 'pages', '1', '0', 'abc123', 'abcdef1', '20adf3c.patch'],
  ...['%zz', '%E0%A4%A', '%2F', 'a%20b', '100%', 'assigned', 'created', 'review-requested', 'files', 'changes', 'checks'],
  ...['repositories', 'people', 'o', 'next.js', '.github', 'favicon.ico'],
];
const QUERIES = ['', '?q=fix', '?tab=stars', '?tab=repositories', '?type=discussions', '?type=Code&q=x', '?template=bug.yml', '?template=Bug.YAML', '?expand=1'];

function* corpus() {
  for (const url of BOOTED) {
    const { pathname: path, search } = new URL(url, 'https://github.com');
    const parts = path.split('/').slice(1);
    const paths = new Set([path]);
    for (const segment of SEGMENTS) {
      paths.add(`${path.replace(/\/$/, '')}/${segment}`);
      for (let i = 0; i < parts.length; i++) paths.add(`/${parts.toSpliced(i, 1, segment).join('/')}`);
    }
    for (let i = 0; i < parts.length; i++) paths.add(`/${parts.toSpliced(i, 1).join('/')}`);
    for (const variant of paths) for (const query of [search, ...QUERIES]) yield `https://github.com${variant}${query}`;
  }
}

describe('boot rules', () => {
  it.each(BOOTED)('loads %s on the boot page, which maps back to it', (path) => {
    const boot = allOn(`https://github.com${path}`);
    expect(boot).not.toBeNull();
    expect(bootTarget(new URL(boot!))).toBe(path);
  });

  it('only redirects URLs that matchRoute owns, and none of a surface that is off', () => {
    let booted = 0;
    for (const url of corpus()) {
      if (!allOn(url)) continue;
      booted++;
      const route = matchRoute(new URL(url));
      expect(route, url).not.toBeNull();
      expect(withOff[surfaceOf(route!)](url), url).toBeNull();
    }
    expect(booted).toBeGreaterThan(1000);
  });

  it('leaves the boot page, reserved paths and GitHub-only views alone', () => {
    for (const path of ['/site/unmerged-boot/o/r/pull/1', '/settings/profile', '/About', '/orgs/acme/pull/1', '/o/r/releases?q=fix', '/o/r/releases/tag/untagged-1']) {
      expect(allOn(`https://github.com${path}`), path).toBeNull();
    }
  });
});

describe('bootTarget', () => {
  it('carries the path, query and fragment, and ignores other pages', () => {
    expect(bootTarget(new URL('https://github.com/site/unmerged-boot/o/r/pulls?q=is%3Aopen+label:%22a+b%22#top'))).toBe('/o/r/pulls?q=is%3Aopen+label:%22a+b%22#top');
    expect(bootTarget(new URL('https://github.com/site/unmerged-boot/o/r/issues/1#issuecomment-123'))).toBe('/o/r/issues/1#issuecomment-123');
    expect(bootTarget(new URL('https://github.com/site/unmerged-boot/'))).toBe('/');
    expect(bootTarget(new URL('https://github.com/site/unmerged-boot'))).toBeNull();
    expect(bootTarget(new URL('https://github.com/o/r/pull/1'))).toBeNull();
  });
});
