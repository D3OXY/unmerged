import { describe, expect, it } from 'vitest';
import { defaultQuery, qualifierOf, repoListQuery, withQualifier, workQueryOf, type Qualifier } from './queries';

describe('workQueryOf', () => {
  it.each([
    ['https://github.com/pulls?q=is:pr+label:bug', 'is:pr label:bug'],
    ['https://github.com/o/r/issues?q=is:closed', 'is:closed'],
  ])("uses the URL's ?q= for %s", (url, expected) => {
    expect(workQueryOf(new URL(url), 'unused')).toBe(expected);
  });

  it.each([
    ['https://github.com/pulls/assigned', defaultQuery('pr', 'assigned'), 'is:open is:pr assignee:@me archived:false sort:updated-desc'],
    ['https://github.com/pulls/assigned?q=', defaultQuery('pr', 'assigned'), 'is:open is:pr assignee:@me archived:false sort:updated-desc'],
    ['https://github.com/o/r/issues', repoListQuery('issues'), 'is:open is:issue'],
    ['https://github.com/o/r/pulls?q=', repoListQuery('pulls'), 'is:open is:pr'],
  ])('falls back to the bare-URL search for %s', (url, fallback, expected) => {
    expect(workQueryOf(new URL(url), fallback)).toBe(expected);
  });
});

describe('withQualifier', () => {
  it.each<[string, Qualifier, string, string]>([
    // State goes first, and `state:` is GitHub's newer spelling of `is:`.
    [defaultQuery('pr', 'created'), 'state', 'is:closed', 'is:closed is:pr author:@me archived:false sort:updated-desc'],
    ['is:pr state:open  review-requested:@me', 'state', 'is:closed', 'is:closed is:pr review-requested:@me'],
    ['is:issue is:merged', 'state', 'is:open', 'is:open is:issue'],
    ['', 'state', 'is:open', 'is:open'],
    // Sort, set or removed.
    ['is:pr sort:updated-desc', 'sort', 'sort:created-asc', 'is:pr sort:created-asc'],
    ['is:pr sort:updated-desc archived:false', 'sort', '', 'is:pr archived:false'],
    // Every matching term is replaced, quoted values included; negated terms are kept.
    ['label:bug is:pr label:"good first issue" -label:wontfix', 'label', 'label:docs', 'is:pr -label:wontfix label:docs'],
    ['author:me is:pr', 'author', '', 'is:pr'],
    // The Review chip owns `review-requested:` too.
    ['is:pr review-requested:@me', 'review', 'review:approved', 'is:pr review:approved'],
    ['is:pr status:failure', 'ci', 'status:success', 'is:pr status:success'],
    // Only whole qualifiers count: a bare `author:` and a value that looks like a qualifier aren't matched.
    ['is:pr author:', 'author', 'author:x', 'is:pr author: author:x'],
    ['is:pr label:is:open', 'state', 'is:closed', 'is:closed is:pr label:is:open'],
  ])('%j, %s → %s gives %j', (q, name, token, expected) => {
    expect(withQualifier(q, name, token)).toBe(expected);
  });
});

describe('qualifierOf', () => {
  it.each<[string, Qualifier, string]>([
    ['is:pr label:"good first issue" label:bug', 'label', 'label:"good first issue"'],
    ['is:pr -label:bug', 'label', ''],
    ['state:open is:pr', 'state', 'state:open'],
    ['is:pr review-requested:@me', 'review', 'review-requested:@me'],
    ['is:pr', 'sort', ''],
  ])('%j, %s → %j', (q, name, expected) => {
    expect(qualifierOf(q, name)).toBe(expected);
  });
});
