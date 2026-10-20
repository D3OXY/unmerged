import { useQuery } from '@tanstack/react-query';
import { persisted, viewerKey } from '@/lib/persist';
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

async function fetchViewer() {
  return (await gql<{ viewer: Viewer }>(VIEWER_QUERY)).viewer;
}

export function useViewer() {
  return useQuery({
    queryKey: viewerKey,
    queryFn: fetchViewer,
    staleTime: 5 * 60_000,
    // The sidebar paints with it on every page: the app starts with the stored result (see `readPersisted`).
    persister: persisted,
  });
}
