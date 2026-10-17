import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { gql, restHtml } from '@/github/client';
import { absolutizeReadme } from '@/github/readme';
import { REPO_CARD_FIELDS } from '@/github/types';
import { persisted } from '@/lib/persist';
import { PEOPLE_PAGE, PERSON_FIELDS, type PeoplePage, type ProfileWork } from '@/pages/profile/queries';

// Like a profile, the overview is separate requests sent together (GitHub resolves a query's fields one
// after another): who the organization is, which also heads its lists, and its repositories.

const ORG_QUERY = /* GraphQL */ `
  query Org($login: String!) {
    organization(login: $login) {
      login name avatarUrl description websiteUrl location email twitterUsername isVerified
      viewerIsAMember hasSponsorsListing
      repositories(ownerAffiliations: OWNER) { totalCount }
      membersWithRole(first: 24) { totalCount nodes { login name avatarUrl } }
    }
  }
`;

const WORK_QUERY = /* GraphQL */ `
  query OrgWork($login: String!) {
    organization(login: $login) {
      pinnedItems(first: 6, types: [REPOSITORY]) { nodes { ... on Repository { ...RepoCard } } }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount nodes { ...RepoCard }
      }
    }
  }
  ${REPO_CARD_FIELDS}
`;

const PEOPLE_QUERY = /* GraphQL */ `
  query OrgPeople($login: String!, $after: String) {
    organization(login: $login) {
      membersWithRole(first: 50, after: $after) ${PEOPLE_PAGE}
    }
  }
  ${PERSON_FIELDS}
`;

export type Org = {
  login: string;
  name: string | null;
  avatarUrl: string;
  description: string | null;
  websiteUrl: string | null;
  location: string | null;
  email: string | null;
  twitterUsername: string | null;
  isVerified: boolean;
  viewerIsAMember: boolean;
  hasSponsorsListing: boolean;
  repositories: { totalCount: number };
  /** Public members only, unless you're one. */
  membersWithRole: { totalCount: number; nodes: { login: string; name: string | null; avatarUrl: string }[] };
};

const key = (login: string) => login.toLowerCase();

/** Who the organization is, with the counts its tabs show. Null when there's no such organization. */
export const orgQuery = (login: string) =>
  queryOptions({
    queryKey: ['org', key(login)],
    queryFn: async () => (await gql<{ organization: Org | null }>(ORG_QUERY, { login }, true)).organization,
    persister: persisted,
  });

/** Pinned repositories and the 100 most recently pushed. Same shape as a profile's. */
export const orgWorkQuery = (login: string) =>
  queryOptions({
    queryKey: ['org-work', key(login)],
    queryFn: async () => (await gql<{ organization: ProfileWork | null }>(WORK_QUERY, { login }, true)).organization,
    persister: persisted,
  });

// Members see the `.github-private` README, everyone else the `.github` one; fetching both at once and
// preferring the private one gets that without waiting on membership first.
const README_REPOS = ['.github-private', '.github'];

/** The organization's profile README (`<repo>/profile/README.md`), rendered by GitHub; null when there isn't one. */
export const orgReadmeQuery = (login: string) =>
  queryOptions({
    queryKey: ['org-readme', key(login)],
    queryFn: async () => {
      const [members, everyone] = await Promise.all(
        README_REPOS.map(async (repo) => {
          const html = await restHtml(`/repos/${login}/${repo}/contents/profile/README.md`);
          const repoUrl = `https://github.com/${login}/${repo}`;
          return html ? { repo, html: absolutizeReadme(html, `${repoUrl}/raw/HEAD/`, `${repoUrl}/blob/HEAD/`, 'profile/') } : null;
        }),
      );
      return members ?? everyone ?? null;
    },
    staleTime: 10 * 60_000,
    persister: persisted,
  });

/** The organization's members, 50 per page (public ones only, unless you're a member). */
export const orgPeopleQuery = (login: string) =>
  infiniteQueryOptions({
    queryKey: ['org-people', key(login)],
    queryFn: async ({ pageParam }) =>
      (await gql<{ organization: { membersWithRole: PeoplePage } | null }>(PEOPLE_QUERY, { login, after: pageParam }, true)).organization?.membersWithRole ?? null,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last?.pageInfo.hasNextPage ? last.pageInfo.endCursor : null),
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<PeoplePage | null>,
  });
