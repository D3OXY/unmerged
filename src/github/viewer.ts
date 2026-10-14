import { useQuery } from '@tanstack/react-query';
import { rememberOrgs } from '@/lib/orgs';
import { gql } from './client';

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      login name avatarUrl
      repositories(first: 8, orderBy: { field: PUSHED_AT, direction: DESC }, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
        nodes { nameWithOwner url isPrivate }
      }
      organizations(first: 8) { nodes { login avatarUrl url } }
    }
  }
`;

export type Viewer = {
  login: string;
  name: string | null;
  avatarUrl: string;
  repositories: { nodes: { nameWithOwner: string; url: string; isPrivate: boolean }[] };
  organizations: { nodes: { login: string; avatarUrl: string; url: string }[] };
};

// The viewer drives the sidebar on every page, so it's cached across page loads for an instant shell.
const CACHE_KEY = 'unmerged:viewer';

function readCache(): Viewer | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Viewer) : undefined;
  } catch {
    return undefined;
  }
}

export function useViewer() {
  return useQuery({
    queryKey: ['viewer'],
    queryFn: async () => {
      const { viewer } = await gql<{ viewer: Viewer }>(VIEWER_QUERY);
      localStorage.setItem(CACHE_KEY, JSON.stringify(viewer));
      rememberOrgs(viewer.organizations.nodes.map((org) => org.login));
      return viewer;
    },
    initialData: readCache,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });
}
