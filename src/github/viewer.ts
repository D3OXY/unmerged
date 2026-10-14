import { useQuery } from '@tanstack/react-query';
import { localCache } from '@/lib/localCache';
import { rememberOrgs } from '@/lib/orgs';
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
const cache = localCache<Viewer>('unmerged:viewer');

export function useViewer() {
  return useQuery({
    queryKey: ['viewer'],
    queryFn: async () => {
      const { viewer } = await gql<{ viewer: Viewer }>(VIEWER_QUERY);
      cache.set(viewer);
      rememberOrgs(viewer.organizations.nodes.map((org) => org.login));
      return viewer;
    },
    initialData: cache.get,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });
}
