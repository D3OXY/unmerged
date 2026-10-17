import { describe, expect, it } from 'vitest';
import { matchRoute } from '@/lib/routes';
import { searchHref, type SearchRoute } from './queries';

describe('searchHref', () => {
  it.each<SearchRoute>([
    { kind: 'search', q: 'react hooks', type: 'repositories', sort: '' },
    { kind: 'search', q: 'repo:o/r is:open "a b"', type: 'pullrequests', sort: 'created-asc' },
    { kind: 'search', q: 'fix', type: 'commits', sort: 'author-date-desc' },
  ])('round-trips $type "$sort" through the URL', (route) => {
    expect(matchRoute(new URL(searchHref(route), 'https://github.com'))).toEqual(route);
  });

  it('writes the sort as GitHub does', () => {
    expect(searchHref({ q: 'x', type: 'commits', sort: 'author-date-asc' })).toBe('/search?q=x&type=commits&s=author-date&o=asc');
  });
});
