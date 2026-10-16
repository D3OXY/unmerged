import { describe, expect, it } from 'vitest';
import { defaultQuery, withState, workQueryOf } from './queries';

describe('workQueryOf', () => {
  it("uses the URL's ?q=", () => {
    expect(workQueryOf(new URL('https://github.com/pulls?q=is:pr+label:bug'), 'pr', 'created')).toBe('is:pr label:bug');
  });

  it.each(['https://github.com/pulls/assigned', 'https://github.com/pulls/assigned?q='])("falls back to GitHub's default search for %s", (url) => {
    expect(workQueryOf(new URL(url), 'pr', 'assigned')).toBe('is:open is:pr assignee:@me archived:false sort:updated-desc');
  });
});

describe('withState', () => {
  it.each([
    [defaultQuery('pr', 'created'), 'closed', 'is:closed is:pr author:@me archived:false sort:updated-desc'],
    ['is:pr state:open  review-requested:@me', 'closed', 'is:closed is:pr review-requested:@me'],
    ['is:issue is:merged', 'open', 'is:open is:issue'],
    ['is:pr', 'open', 'is:open is:pr'],
    ['', 'open', 'is:open'],
    // Only whole qualifiers count.
    ['is:pr label:is:open', 'closed', 'is:closed is:pr label:is:open'],
  ] as const)('%j → is:%s', (q, state, expected) => {
    expect(withState(q, state)).toBe(expected);
  });
});
