import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { gql, GitHubError } from '@/github/client';
import { prProjectsQuery } from './Projects';

vi.mock('@/github/client', async (actual) => ({ ...(await actual<typeof import('@/github/client')>()), gql: vi.fn() }));
vi.mock('@/lib/persist', () => ({ persisted: undefined }));

describe('prProjectsQuery', () => {
  it('is null without the project scope, and stops asking', async () => {
    vi.mocked(gql).mockRejectedValueOnce(new GitHubError('no scope', 200, { kind: 'scope' }));
    const client = new QueryClient();
    expect(await client.fetchQuery(prProjectsQuery('o', 'r', 1))).toBeNull();
    expect(await client.fetchQuery(prProjectsQuery('o', 'r', 2))).toBeNull();
    expect(gql).toHaveBeenCalledTimes(1);
  });
});
