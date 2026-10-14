import { gql } from '@/github/client';
import type { Actor, CheckState, Language } from '@/github/types';

export const REPO_QUERY = /* GraphQL */ `
  query Repo($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id name nameWithOwner description homepageUrl url sshUrl isPrivate isArchived isFork isTemplate isEmpty
      owner { login avatarUrl }
      parent { nameWithOwner }
      stargazerCount forkCount
      watchers { totalCount }
      viewerHasStarred viewerSubscription viewerCanAdminister
      hasIssuesEnabled hasDiscussionsEnabled hasWikiEnabled
      defaultBranchRef { name }
      repositoryTopics(first: 20) { nodes { topic { name } } }
      licenseInfo { name spdxId }
      languages(first: 8, orderBy: { field: SIZE, direction: DESC }) { totalSize edges { size node { name color } } }
      latestRelease { name tagName publishedAt url }
      releases { totalCount }
      branches: refs(refPrefix: "refs/heads/", first: 0) { totalCount }
      tags: refs(refPrefix: "refs/tags/", first: 0) { totalCount }
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
    }
  }
`;

export type Subscription = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED';

export type Repo = {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  homepageUrl: string | null;
  url: string;
  sshUrl: string;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  isTemplate: boolean;
  isEmpty: boolean;
  owner: { login: string; avatarUrl: string };
  parent: { nameWithOwner: string } | null;
  stargazerCount: number;
  forkCount: number;
  watchers: { totalCount: number };
  viewerHasStarred: boolean;
  viewerSubscription: Subscription | null;
  viewerCanAdminister: boolean;
  hasIssuesEnabled: boolean;
  hasDiscussionsEnabled: boolean;
  hasWikiEnabled: boolean;
  defaultBranchRef: { name: string } | null;
  repositoryTopics: { nodes: { topic: { name: string } }[] };
  licenseInfo: { name: string; spdxId: string | null } | null;
  languages: { totalSize: number; edges: { size: number; node: NonNullable<Language> }[] };
  latestRelease: { name: string | null; tagName: string; publishedAt: string | null; url: string } | null;
  releases: { totalCount: number };
  branches: { totalCount: number };
  tags: { totalCount: number };
  issues: { totalCount: number };
  pullRequests: { totalCount: number };
};

/**
 * Splits "<ref>/<path…>" segments into ref and path. Branch names may contain slashes, so every split is
 * tried in one request and the shortest ref that exists wins (GitHub does the same).
 */
export async function resolveRefPath(owner: string, name: string, rest: string[]): Promise<{ ref: string; path: string } | null> {
  const candidates = rest.slice(0, 8).map((_, i) => ({ ref: rest.slice(0, i + 1).join('/'), path: rest.slice(i + 1).join('/') }));
  const query = `query Resolve($owner: String!, $name: String!, ${candidates.map((_, i) => `$e${i}: String!`).join(', ')}) {
    repository(owner: $owner, name: $name) { ${candidates.map((_, i) => `c${i}: object(expression: $e${i}) { __typename }`).join(' ')} }
  }`;
  const variables = Object.fromEntries(candidates.map((c, i) => [`e${i}`, `${c.ref}:${c.path}`]));
  const data = await gql<{ repository: Record<string, { __typename: string } | null> | null }>(query, { owner, name, ...variables });
  const index = candidates.findIndex((_, i) => data.repository?.[`c${i}`]);
  return index === -1 ? null : candidates[index]!;
}

export const CONTENT_QUERY = /* GraphQL */ `
  query RepoContent($owner: String!, $name: String!, $expr: String!, $ref: String!, $path: String) {
    repository(owner: $owner, name: $name) {
      object(expression: $expr) {
        __typename
        ... on Tree { entries { name type path submodule { gitUrl } object { ... on Blob { byteSize } } } }
        ... on Blob { oid byteSize isBinary isTruncated text }
      }
      commit: object(expression: $ref) {
        ... on Commit {
          oid
          history(first: 1, path: $path) { totalCount nodes { ...LastCommit } }
        }
      }
    }
  }
  fragment LastCommit on Commit {
    oid abbreviatedOid messageHeadline committedDate url
    author { name user { login avatarUrl } }
    statusCheckRollup { state }
  }
`;

export type TreeEntry = {
  name: string;
  type: 'tree' | 'blob' | 'commit';
  path: string;
  submodule: { gitUrl: string } | null;
  object: { byteSize?: number } | null;
};

export type LastCommit = {
  oid: string;
  abbreviatedOid: string;
  messageHeadline: string;
  committedDate: string;
  url: string;
  author: { name: string | null; user: Actor } | null;
  statusCheckRollup: { state: CheckState } | null;
};

export type ContentData = {
  repository: {
    object:
      | { __typename: 'Tree'; entries: TreeEntry[] }
      | { __typename: 'Blob'; oid: string; byteSize: number; isBinary: boolean | null; isTruncated: boolean; text: string | null }
      | null;
    commit: { oid: string; history: { totalCount: number; nodes: LastCommit[] } } | null;
  } | null;
};

/** Latest commit touching each entry, in one request (one aliased `history` per path). */
export async function fetchEntryCommits(owner: string, name: string, ref: string, paths: string[]) {
  if (!paths.length) return {};
  const list = paths.slice(0, 80);
  const query = `query EntryCommits($owner: String!, $name: String!, $ref: String!, ${list.map((_, i) => `$p${i}: String!`).join(', ')}) {
    repository(owner: $owner, name: $name) {
      object(expression: $ref) { ... on Commit { ${list.map((_, i) => `e${i}: history(first: 1, path: $p${i}) { nodes { messageHeadline committedDate url } }`).join(' ')} } }
    }
  }`;
  type Entry = { nodes: { messageHeadline: string; committedDate: string; url: string }[] };
  const data = await gql<{ repository: { object: Record<string, Entry> | null } | null }>(query, {
    owner,
    name,
    ref,
    ...Object.fromEntries(list.map((p, i) => [`p${i}`, p])),
  });
  const object = data.repository?.object;
  return Object.fromEntries(list.map((path, i) => [path, object?.[`e${i}`]?.nodes[0] ?? null]));
}

export const REFS_QUERY = /* GraphQL */ `
  query Refs($owner: String!, $name: String!, $q: String) {
    repository(owner: $owner, name: $name) {
      branches: refs(refPrefix: "refs/heads/", first: 30, query: $q, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) { nodes { name } }
      tags: refs(refPrefix: "refs/tags/", first: 15, query: $q, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) { nodes { name } }
    }
  }
`;

export type RefsData = { repository: { branches: { nodes: { name: string }[] }; tags: { nodes: { name: string }[] } } | null };

export const REPO_MUTATIONS = {
  star: `mutation Star($id: ID!) { addStar(input: { starrableId: $id }) { clientMutationId } }`,
  unstar: `mutation Unstar($id: ID!) { removeStar(input: { starrableId: $id }) { clientMutationId } }`,
  subscribe: `mutation Watch($id: ID!, $state: SubscriptionState!) { updateSubscription(input: { subscribableId: $id, state: $state }) { clientMutationId } }`,
};
