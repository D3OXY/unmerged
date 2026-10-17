import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { rest } from '@/github/client';
import type { CommitRowData } from '@/ui/CommitList';
import { compareHref, compareQuery, newPullRequest, prefill } from './query';

vi.mock('@/github/client', () => ({ gql: vi.fn(), rest: vi.fn() }));

const commit = (messageHeadline: string, messageBody = '') => ({ messageHeadline, messageBody }) as CommitRowData;

describe('prefill', () => {
  it('takes a single commit’s message', () => {
    expect(prefill([commit('Fix the login redirect', 'It looped.')], 'fix/login', null)).toEqual({ title: 'Fix the login redirect', body: 'It looped.' });
  });

  it('turns the branch into a sentence for several commits, without a fork’s owner', () => {
    expect(prefill([commit('a'), commit('b')], 'user:feature/add-dark_mode', null)).toEqual({ title: 'Feature/add dark mode', body: '' });
  });

  it('prefers the repo’s template for the body', () => {
    expect(prefill([commit('Fix', 'details')], 'fix', '## Summary')).toEqual({ title: 'Fix', body: '## Summary' });
  });
});

describe('newPullRequest', () => {
  const fields = { owner: 'o', repo: 'r', base: 'main', title: 'T', body: 'B', draft: true };

  it.each([
    ['feature/x', { head: 'feature/x' }],
    ['user:feature/x', { head: 'user:feature/x' }],
    ['user:r:feature/x', { head: 'user:feature/x' }],
    ['user:renamed:feature/x', { head: 'user:feature/x', head_repo: 'renamed' }],
  ])('sends head %s as GitHub expects', (head, expected) => {
    expect(newPullRequest({ ...fields, head })).toEqual({ title: 'T', body: 'B', draft: true, base: 'main', ...expected });
  });
});

describe('compare URLs', () => {
  it('keeps slashes and a fork’s owner, and encodes the rest', () => {
    expect(compareHref('o/r', 'release/1.x', 'user:fix/a#b', true)).toBe('/o/r/compare/release/1.x...user:fix/a%23b?expand=1');
    expect(compareHref('o/r', undefined, 'feature', false)).toBe('/o/r/compare/feature');
  });

  it('asks the API for the default branch as HEAD and maps REST commits', async () => {
    vi.mocked(rest).mockResolvedValue({
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      commits: [{ sha: 'abcdef1234', author: null, commit: { message: 'Subject\n\nBody', author: { name: 'Ann' }, committer: { date: '2026-01-01T00:00:00Z' } } }],
    });
    const data = await new QueryClient().fetchQuery(compareQuery('o', 'r', undefined, 'feature/x'));
    expect(vi.mocked(rest).mock.calls[0]?.[0]).toBe('/repos/o/r/compare/HEAD...feature/x');
    expect(data.commits[0]).toMatchObject({ oid: 'abcdef1234', abbreviatedOid: 'abcdef1', messageHeadline: 'Subject', messageBody: 'Body', author: { name: 'Ann', user: null } });
    expect(data.files).toEqual([]);
  });
});
