import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { gql, restHtml } from '@/github/client';
import { absolutizeReadme } from '@/github/readme';
import { REPO_CARD_FIELDS, type RepoCard } from '@/github/types';
import { persisted } from '@/lib/persist';
import { PR_ROW_FIELDS, type PrRowData } from '@/ui/WorkRow';
import type { ContributionWeek } from './ContributionGraph';

// A profile is three requests sent together rather than one: GitHub resolves a query's fields one after
// another, so the single query took ~1.8 s while each part takes ~0.4 s. The header shows when `user`
// lands; the other sections fill in as theirs do.

const USER_QUERY = /* GraphQL */ `
  query ProfileUser($login: String!) {
    user(login: $login) {
      id login name avatarUrl bio company location websiteUrl pronouns createdAt
      status { emojiHTML message }
      followers { totalCount }
      following { totalCount }
      starredRepositories { totalCount }
      sponsors { totalCount }
      isViewer viewerIsFollowing viewerCanFollow isFollowingViewer hasSponsorsListing
      isHireable isEmployee isGitHubStar isDeveloperProgramMember isCampusExpert isBountyHunter
      socialAccounts(first: 10) { nodes { provider url displayName } }
      organizations(first: 12) { nodes { login avatarUrl } }
    }
  }
`;

const WORK_QUERY = /* GraphQL */ `
  query ProfileWork($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: [REPOSITORY]) { nodes { ... on Repository { ...RepoCard } } }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount nodes { ...RepoCard }
      }
    }
  }
  ${REPO_CARD_FIELDS}
`;

const ACTIVITY_QUERY = /* GraphQL */ `
  query ProfileActivity($login: String!) {
    user(login: $login) {
      repositoriesContributedTo(first: 12, includeUserRepositories: false, contributionTypes: [COMMIT, PULL_REQUEST, PULL_REQUEST_REVIEW]) {
        nodes { ...RepoCard owner { avatarUrl } }
      }
      pullRequests(first: 6, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ...PrRow } }
      contributionsCollection {
        totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions totalIssueContributions
        restrictedContributionsCount
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
      }
    }
  }
  ${REPO_CARD_FIELDS}
  ${PR_ROW_FIELDS}
`;

export type ProfileUser = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  websiteUrl: string | null;
  pronouns: string | null;
  createdAt: string;
  status: { emojiHTML: string | null; message: string | null } | null;
  followers: { totalCount: number };
  following: { totalCount: number };
  starredRepositories: { totalCount: number };
  sponsors: { totalCount: number };
  isViewer: boolean;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  isFollowingViewer: boolean;
  hasSponsorsListing: boolean;
  isHireable: boolean;
  isEmployee: boolean;
  isGitHubStar: boolean;
  isDeveloperProgramMember: boolean;
  isCampusExpert: boolean;
  isBountyHunter: boolean;
  socialAccounts: { nodes: { provider: string; url: string; displayName: string }[] };
  organizations: { nodes: { login: string; avatarUrl: string }[] };
};

export type ProfileWork = {
  pinnedItems: { nodes: RepoCard[] };
  repositories: { totalCount: number; nodes: RepoCard[] };
};

export type ProfileActivity = {
  repositoriesContributedTo: { nodes: (RepoCard & { owner: { avatarUrl: string } })[] };
  pullRequests: { nodes: PrRowData[] };
  contributionsCollection: {
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalIssueContributions: number;
    restrictedContributionsCount: number;
    contributionCalendar: { totalContributions: number; weeks: ContributionWeek[] };
  };
};

const key = (login: string) => login.toLowerCase();

/** Null when the login isn't a user: an organization (see OwnerPage), or nobody. */
export const profileUserQuery = (login: string) =>
  queryOptions({
    queryKey: ['profile', key(login)],
    queryFn: async () => (await gql<{ user: ProfileUser | null }>(USER_QUERY, { login }, true)).user,
    persister: persisted,
  });

export const profileWorkQuery = (login: string) =>
  queryOptions({
    queryKey: ['profile-work', key(login)],
    queryFn: async () => (await gql<{ user: ProfileWork | null }>(WORK_QUERY, { login }, true)).user,
    persister: persisted,
  });

export const profileActivityQuery = (login: string) =>
  queryOptions({
    queryKey: ['profile-activity', key(login)],
    queryFn: async () => (await gql<{ user: ProfileActivity | null }>(ACTIVITY_QUERY, { login }, true)).user,
    persister: persisted,
  });

/** The `<login>/<login>` profile README, rendered by GitHub; null when there isn't one. */
export const profileReadmeQuery = (login: string) =>
  queryOptions({
    queryKey: ['readme', key(login)],
    queryFn: async () => {
      const html = await restHtml(`/repos/${login}/${login}/readme`);
      const repoUrl = `https://github.com/${login}/${login}`;
      return html && absolutizeReadme(html, `${repoUrl}/raw/HEAD/`, `${repoUrl}/blob/HEAD/`);
    },
    staleTime: 10 * 60_000,
    persister: persisted,
  });

const HEAD_QUERY = /* GraphQL */ `
  query ProfileHead($login: String!) {
    user(login: $login) {
      login name avatarUrl isViewer
      repositories(ownerAffiliations: OWNER) { totalCount }
      followers { totalCount }
      following { totalCount }
      starredRepositories { totalCount }
    }
  }
`;

export type ProfileHead = {
  login: string;
  name: string | null;
  avatarUrl: string;
  isViewer: boolean;
  repositories: { totalCount: number };
  followers: { totalCount: number };
  following: { totalCount: number };
  starredRepositories: { totalCount: number };
};

/** Who a sub-page (repositories, followers…) belongs to, with the counts its tabs show. Null for organizations. */
export const profileHeadQuery = (login: string) =>
  queryOptions({
    queryKey: ['profile-head', key(login)],
    queryFn: async () => (await gql<{ user: ProfileHead | null }>(HEAD_QUERY, { login }, true)).user,
    persister: persisted,
  });

/** What a `Person` row shows of a user; search results use it too. */
export const PERSON_FIELDS = /* GraphQL */ `
  fragment Person on User {
    id login name avatarUrl bio company location
    isViewer viewerIsFollowing viewerCanFollow isFollowingViewer
    followers { totalCount }
  }
`;

/** A page of people, as FollowsPage's rows show them. Queries using it include `PERSON_FIELDS`. */
export const PEOPLE_PAGE = /* GraphQL */ `{ pageInfo { hasNextPage endCursor } nodes { ...Person } }`;

// Followers and following are different connection types, so each gets its own (mutually exclusive) field.
const FOLLOWS_QUERY = /* GraphQL */ `
  query Follows($login: String!, $followers: Boolean!, $after: String) {
    user(login: $login) {
      followerList: followers(first: 50, after: $after) @include(if: $followers) ${PEOPLE_PAGE}
      followingList: following(first: 50, after: $after) @skip(if: $followers) ${PEOPLE_PAGE}
    }
  }
  ${PERSON_FIELDS}
`;

export type Person = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  isViewer: boolean;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  isFollowingViewer: boolean;
  /** Null for an organization (in search results), which has no followers. */
  followers: { totalCount: number } | null;
};

export type PeoplePage = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Person[] };

type Follows = { followerList?: PeoplePage; followingList?: PeoplePage };

type FollowsPage = { people: PeoplePage } | null;

/** Followers or following, 50 per page. Null for organizations; ProfileFrame sends those to the org's page. */
export const followsQuery = (login: string, tab: 'followers' | 'following') =>
  infiniteQueryOptions({
    queryKey: ['follows', key(login), tab],
    queryFn: async ({ pageParam }): Promise<FollowsPage> => {
      const { user } = await gql<{ user: Follows | null }>(FOLLOWS_QUERY, { login, followers: tab === 'followers', after: pageParam }, true);
      // The query asks for exactly one of the two.
      return user && { people: (user.followerList ?? user.followingList)! };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last?.people.pageInfo.hasNextPage ? last.people.pageInfo.endCursor : null),
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<FollowsPage>,
  });

/** What a repository row (`OwnedRepo`) shows; search results use it too. Includes the `RepoCard` fragment. */
export const REPO_ROW_FIELDS = /* GraphQL */ `
  fragment RepoRow on Repository {
    ...RepoCard
    isMirror isTemplate viewerHasStarred
    licenseInfo { spdxId name }
    parent { nameWithOwner }
    repositoryTopics(first: 6) { nodes { topic { name } } }
  }
  ${REPO_CARD_FIELDS}
`;

const REPOS_QUERY = /* GraphQL */ `
  query ProfileRepos($login: String!, $after: String) {
    repositoryOwner(login: $login) {
      repositories(first: 100, after: $after, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { ...RepoRow }
      }
    }
  }
  ${REPO_ROW_FIELDS}
`;

export type OwnedRepo = RepoCard & {
  isMirror: boolean;
  isTemplate: boolean;
  viewerHasStarred: boolean;
  licenseInfo: { spdxId: string | null; name: string } | null;
  parent: { nameWithOwner: string } | null;
  repositoryTopics: { nodes: { topic: { name: string } }[] };
};

type ReposPage = { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: OwnedRepo[] };

/** Every repository a user or organization owns, 100 per page. */
export const profileReposQuery = (login: string) =>
  infiniteQueryOptions({
    queryKey: ['profile-repos', key(login)],
    queryFn: async ({ pageParam }) =>
      (await gql<{ repositoryOwner: { repositories: ReposPage } | null }>(REPOS_QUERY, { login, after: pageParam }, true)).repositoryOwner?.repositories ?? null,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last?.pageInfo.hasNextPage ? last.pageInfo.endCursor : null),
    persister: persisted<ReposPage | null>,
  });
