import type { Browser } from 'wxt/browser';
import { BOOT_PATH } from './boot';
import { RESERVED, SEARCH_TYPES, type Route } from './routes';
import { surfaceOf, type Surfaces } from './settings';

// The redirect rules that load owned pages on the boot page (see boot.ts), from one table of patterns by route
// kind. The background rebuilds them when the surfaces change.

type Rule = Browser.declarativeNetRequest.Rule;

// Pieces of the patterns (RE2 syntax, matched against the raw URL). Narrower than `matchRoute` where that is
// simpler: no `%` in names, and in other segments only escapes of ASCII characters, which always decode.
const OWNER = '[A-Za-z0-9-]+';
const REPO = '[A-Za-z0-9_.-]+';
const NUMBER = '[0-9]+';
const SHA = '[0-9A-Fa-f]{7,}';
const CHAR = '(?:[^/?%]|%[2-7][0-9A-Fa-f])';
const SEGMENT = `${CHAR}+`;
// A ref without "..", ":" or a final ".diff"/".patch": a dot must have a digit after it (v1.2.3).
const REF = '[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+|\\.[0-9][A-Za-z0-9_-]*)*';
const ANY_QUERY = '(?:\\?.*)?';
const VALUE = '[^&]*';

/** A query (or none) made only of these parameters, each value matching its pattern. `{}` allows no query. */
function query(params: Record<string, string>) {
  const param = Object.entries(params)
    .map(([name, value]) => `${name}=${value}`)
    .join('|');
  // Each parameter is written once: `(?:&|$)` ends it, as Chrome's 2 KB limit (below) is tight.
  return param ? `(?:\\?(?:(?:${param})(?:&|$))+)?` : '';
}

// `matchRoute` leaves the other `type`s (discussions, topics…) to GitHub.
const SEARCH_TYPE = `(?:${SEARCH_TYPES.join('|')})`;

/**
 * The paths (and queries) that load on the boot page. Each pattern matches only URLs that `matchRoute` gives its
 * kind (bootRules.test.ts checks this). A pattern may match fewer: those pages load as before, GitHub's page first.
 * One that matched more would cost those loads a second round trip.
 *
 * Chrome skips a regex that compiles to more than 2 KB, and then the whole update with it: each literal character
 * and each repeat counts, so keep patterns short (check with `declarativeNetRequest.isRegexSupported`). A kind may
 * have more than one pattern.
 *
 * SITE pages start with a reserved segment (RESERVED in routes.ts) and win over the rule that keeps reserved
 * segments out; OWNER pages lose to it, so `/settings/profile` is never taken for a repository.
 */
const SITE: [Route['kind'], string][] = [
  ['home', `/${ANY_QUERY}`],
  ['notifications', `/notifications/?${ANY_QUERY}`],
  ['work', `/(?:pulls(?:/(?:assigned|mentioned|review-requested))?|issues(?:/(?:created|assigned|mentioned))?)/?${ANY_QUERY}`],
  ['search', `/search/?${query({ q: VALUE, type: SEARCH_TYPE, s: VALUE, o: VALUE, p: VALUE })}`],
  ['org', `/orgs/${OWNER}/(?:repositories|people)/?${ANY_QUERY}`],
];
const OWNER_PAGES: [Route['kind'], string][] = [
  ['profile', `/${OWNER}/?${query({ tab: '(?:overview|repositories|achievements|followers|following)' })}`],
  ['repo', `/${OWNER}/${REPO}(?:/issues|/pulls)?/?${ANY_QUERY}`],
  ['repo', `/${OWNER}/${REPO}/(?:tree|blob)(?:/${SEGMENT})+/?${ANY_QUERY}`],
  ['repo', `/${OWNER}/${REPO}/commits(?:/${SEGMENT})*/?${ANY_QUERY}`],
  ['pr', `/${OWNER}/${REPO}/pull/${NUMBER}(?:/(?:commits|checks|files|changes))?/?${ANY_QUERY}`],
  ['issue', `/${OWNER}/${REPO}/issues/${NUMBER}/?${ANY_QUERY}`],
  // YAML issue forms are GitHub's, so a template must be Markdown.
  [
    'newIssue',
    `/${OWNER}/${REPO}/issues/new(?:/choose)?/?${query({ template: `${VALUE}\\.md`, title: VALUE, body: VALUE, labels: VALUE })}`,
  ],
  ['compare', `/${OWNER}/${REPO}/compare(?:/(?:${REF}\\.\\.\\.)?${REF})?/?${ANY_QUERY}`],
  ['commit', `/${OWNER}/${REPO}/commit/${SHA}/?${ANY_QUERY}`],
  ['commit', `/${OWNER}/${REPO}/pull/${NUMBER}/commits/${SHA}/?${ANY_QUERY}`],
  ['search', `/${OWNER}/${REPO}/search/?${query({ q: VALUE, type: SEARCH_TYPE })}`],
  ['actions', `/${OWNER}/${REPO}/actions(?:/workflows/(?:${REPO}|[A-Za-z0-9_-]+/${REPO}))?/?${ANY_QUERY}`],
  ['run', `/${OWNER}/${REPO}/actions/runs/${NUMBER}(?:/(?:job|attempts)/[1-9][0-9]*)?/?${ANY_QUERY}`],
  ['branches', `/${OWNER}/${REPO}/branches(?:/(?:yours|active|stale|all))?/?${ANY_QUERY}`],
  ['contributors', `/${OWNER}/${REPO}/graphs/contributors/?${ANY_QUERY}`],
  // Release search (`?q=`) is GitHub's.
  ['releases', `/${OWNER}/${REPO}/(?:releases|tags)/?`],
  // A draft's tag (untagged-…) is GitHub's: no tag that starts with "u".
  ['release', `/${OWNER}/${REPO}/releases/latest/?`],
  ['release', `/${OWNER}/${REPO}/releases/tag/[^u/?%]${CHAR}*(?:/${SEGMENT})*/?`],
];

// Highest wins; at the same priority, allow wins over redirect.
const OWNER_PRIORITY = 1;
const RESERVED_PRIORITY = 2;
const SITE_PRIORITY = 3;
const TAB_PRIORITY = 4;

// The reserved segments, a few per rule to stay under Chrome's limit.
const RESERVED_GROUPS = [...RESERVED].reduce<string[][]>((groups, word) => {
  const last = groups.at(-1);
  if (last && last.join('|').length + word.length < 80) last.push(word);
  else groups.push([word]);
  return groups;
}, []);

const RESERVED_RULES = RESERVED_GROUPS.map(
  (words, index): Rule => ({
    id: index + 1,
    priority: RESERVED_PRIORITY,
    action: { type: 'allow' },
    // Case-insensitive, as `matchRoute` compares them. They also keep the boot page itself (/site/…) from redirecting.
    condition: { regexFilter: `^https://github\\.com/(?:${words.join('|')})(?:[/?]|$)`, isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame'] },
  }),
);

// Ids by position, the same whatever the surfaces, so a rebuild can remove every rule it may have added.
const REDIRECTS = [
  ...SITE.map(([kind, path]) => ({ kind, path, priority: SITE_PRIORITY })),
  ...OWNER_PAGES.map(([kind, path]) => ({ kind, path, priority: OWNER_PRIORITY })),
].map(({ kind, path, priority }, index): { kind: Route['kind']; rule: Rule } => ({
  kind,
  rule: {
    id: RESERVED_RULES.length + index + 1,
    priority,
    action: { type: 'redirect', redirect: { regexSubstitution: `https://github.com${BOOT_PATH}\\1` } },
    // GET only: a form that posts to an owned URL (a new issue in Classic) must reach GitHub.
    condition: { regexFilter: `^https://github\\.com(${path})$`, isUrlFilterCaseSensitive: true, resourceTypes: ['main_frame'], requestMethods: ['get'] },
  },
}));

/** Every rule id that `bootRules` may use. */
export const BOOT_RULE_IDS = [...RESERVED_RULES, ...REDIRECTS.map(({ rule }) => rule)].map(({ id }) => id);

/** The dynamic rules for these surfaces: the redirects of the surfaces that are on, and the reserved rules. */
export function bootRules(surfaces: Surfaces): Rule[] {
  // `?? true`: settings saved before a surface existed don't list it.
  return [...RESERVED_RULES, ...REDIRECTS.filter(({ kind }) => surfaces[surfaceOf({ kind })] ?? true).map(({ rule }) => rule)];
}

/** A session rule that lets tab `tabId` load `url` (without its fragment) as GitHub's own page, past every redirect. */
export function tabAllowRule(tabId: number, url: string): Rule {
  return { id: tabId, priority: TAB_PRIORITY, action: { type: 'allow' }, condition: { urlFilter: `|${url}|`, tabIds: [tabId], resourceTypes: ['main_frame'] } };
}
