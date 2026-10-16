import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GitHubError } from '@/github/client';
import { tokenItem } from '@/lib/settings';
import { filtersOf, notificationsUrl, unreadPollQuery, type Filters, type Notification } from './queries';

const parse = (path: string) => filtersOf(new URL(path, 'https://github.com'));

describe('filtersOf / notificationsUrl', () => {
  it.each<[Filters, string]>([
    [{ view: 'inbox', repo: null, reason: null }, '/notifications'],
    [{ view: 'unread', repo: 'o/r.js', reason: null }, '/notifications?query=is%3Aunread%20repo%3Ao%2Fr.js'],
    [{ view: 'participating', repo: null, reason: 'mention' }, '/notifications?query=reason%3Aparticipating%20reason%3Amention'],
    // GitHub's dashes in the URL, the API's underscores in the filters.
    [{ view: 'inbox', repo: 'o/r', reason: 'review_requested' }, '/notifications?query=repo%3Ao%2Fr%20reason%3Areview-requested'],
  ])('%j ⇄ %s', (filters, url) => {
    expect(notificationsUrl(filters)).toBe(url);
    expect(parse(url)).toEqual(filters);
  });

  it.each(['repo:o/..', 'repo:o/r/x', 'repo:o'])('ignores the invalid repo in %s', (query) => {
    expect(parse(`/notifications?query=${encodeURIComponent(query)}`).repo).toBeNull();
  });
});

describe('unreadPollQuery', () => {
  const thread = { id: '1', unread: true } as Notification;
  const fetchMock = vi.fn<typeof fetch>();

  beforeAll(async () => {
    await tokenItem.setValue('token');
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => fetchMock.mockReset());

  it('asks If-Modified-Since and keeps the last answer on a 304', async () => {
    const client = new QueryClient();
    fetchMock.mockResolvedValueOnce(
      Response.json([thread], { headers: { 'Last-Modified': 'Thu, 15 Oct 2026 10:00:00 GMT', 'X-Poll-Interval': '60' } }),
    );
    const first = await client.fetchQuery(unreadPollQuery);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304, headers: { 'X-Poll-Interval': '120' } }));
    const second = await client.fetchQuery(unreadPollQuery);

    expect(new Headers(fetchMock.mock.lastCall?.[1]?.headers).get('If-Modified-Since')).toBe('Thu, 15 Oct 2026 10:00:00 GMT');
    expect(second).toEqual({ ...first, interval: 120 });
    expect(second.unread).toEqual([thread]);
  });

  it('fails with a rate-limit GitHubError, so the poll pauses', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ message: 'API rate limit exceeded' }, { status: 403, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '4102444800' } }),
    );
    const error = await new QueryClient().fetchQuery(unreadPollQuery).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubError);
    expect((error as GitHubError).problem).toEqual({ kind: 'rate-limit', resetAt: 4102444800_000 });
  });
});
