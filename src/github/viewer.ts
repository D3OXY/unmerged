import { useQuery } from '@tanstack/react-query';
import { cachedQuery } from '@/lib/localCache';
import { gql } from './client';

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      login name avatarUrl
      organizations(first: 8) { nodes { login avatarUrl url } }
    }
  }
`;

export type Viewer = {
  login: string;
  name: string | null;
  avatarUrl: string;
  organizations: { nodes: { login: string; avatarUrl: string; url: string }[] };
};

// The viewer drives the sidebar on every page, so it's cached across page loads for an instant shell.
const cache = cachedQuery<Viewer>('unmerged:viewer');

async function fetchViewer() {
  return (await gql<{ viewer: Viewer }>(VIEWER_QUERY)).viewer;
}

export function useViewer() {
  return useQuery({
    queryKey: ['viewer'],
    queryFn: () => cache.save(fetchViewer()),
    initialData: cache.initialData,
    initialDataUpdatedAt: cache.initialDataUpdatedAt,
    staleTime: 5 * 60_000,
  });
}
