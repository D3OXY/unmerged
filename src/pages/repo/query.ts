import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql, restHtml } from '@/github/client';
import { absolutizeReadme } from '@/github/readme';
import { persisted } from '@/lib/persist';
import type { RepoView } from '@/lib/routes';
import { blobUrl, rawUrl } from './urls';
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
      branches: refs(refPrefix: "refs/heads/", first: 0) { totalCount }
      tags: refs(refPrefix: "refs/tags/", first: 0) { totalCount }
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
    }
  }
`;

// The sidebar's slower half (latest release and languages take ~0.6 s), fetched alongside REPO_QUERY rather
// than inside it, which GitHub would resolve one after the other.
const ABOUT_QUERY = /* GraphQL */ `
  query RepoAbout($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      repositoryTopics(first: 20) { nodes { topic { name } } }
      licenseInfo { name spdxId }
      languages(first: 8, orderBy: { field: SIZE, direction: DESC }) { totalSize edges { size node { name color } } }
      latestRelease { name tagName publishedAt url }
      releases { totalCount }
    }
  }
`;

export type RepoAbout = {
  repositoryTopics: { nodes: { topic: { name: string } }[] };
  licenseInfo: { name: string; spdxId: string | null } | null;
  languages: { totalSize: number; edges: { size: number; node: NonNullable<Language> }[] };
  latestRelease: { name: string | null; tagName: string; publishedAt: string | null; url: string } | null;
  releases: { totalCount: number };
};

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

const key = (owner: string, name: string) => [owner.toLowerCase(), name.toLowerCase()] as const;

/** The revision a repo root is read at: its default branch, whatever it's called, without asking first. */
export const DEFAULT_REVISION = 'HEAD';

export const repoQuery = (owner: string, name: string) =>
  queryOptions({
    queryKey: ['repo', ...key(owner, name)],
    queryFn: () => gql<{ repository: Repo | null }>(REPO_QUERY, { owner, name }, true),
    persister: persisted,
  });

export const repoAboutQuery = (owner: string, name: string) =>
  queryOptions({
    queryKey: ['repo-about', ...key(owner, name)],
    queryFn: async () => (await gql<{ repository: RepoAbout | null }>(ABOUT_QUERY, { owner, name }, true)).repository,
    staleTime: 10 * 60_000,
    persister: persisted,
  });

/** "<ref>/<path…>" from a /tree or /blob URL, as ref + path; null when nothing by that name exists. */
export const repoResolveQuery = (owner: string, name: string, rest: string[]) =>
  queryOptions({
    queryKey: ['repo-resolve', ...key(owner, name), rest.join('/')],
    queryFn: () => resolveRefPath(owner, name, rest),
    staleTime: Infinity,
    persister: persisted,
  });

/** A folder's entries or a file's text at a revision, with the last commit touching it. */
export const repoContentQuery = (owner: string, name: string, revision: string, path: string) =>
  queryOptions({
    queryKey: ['repo-content', ...key(owner, name), revision, path],
    queryFn: () => gql<ContentData>(CONTENT_QUERY, { owner, name, expr: `${revision}:${path}`, ref: revision, path: path || null }),
    staleTime: 60_000,
    persister: persisted,
  });

/** A folder's README, rendered by GitHub with links made absolute; null when there isn't one. */
export const repoReadmeQuery = (nameWithOwner: string, revision: string, path: string) =>
  queryOptions({
    queryKey: ['repo-readme', nameWithOwner.toLowerCase(), revision, path],
    queryFn: async () => {
      const at = revision === DEFAULT_REVISION ? '' : `?ref=${encodeURIComponent(revision)}`;
      const html = await restHtml(`/repos/${nameWithOwner}/readme/${path}${at}`);
      const dir = path ? `${path}/` : '';
      return html && absolutizeReadme(html, rawUrl(nameWithOwner, revision, dir), `https://github.com${blobUrl(nameWithOwner, revision, dir)}`);
    },
    staleTime: 5 * 60_000,
    persister: persisted,
  });

/** What a repo URL will show, fetched together: started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchRepo(client: QueryClient, owner: string, name: string, view: Extract<RepoView, 'code' | 'commits'>, rest: string[]) {
  client.prefetchQuery(repoQuery(owner, name));
  if (view === 'commits') {
    if (rest.length) client.prefetchQuery(repoResolveQuery(owner, name, rest));
    return;
  }
  if (!rest.length) {
    client.prefetchQuery(repoAboutQuery(owner, name));
    client.prefetchQuery(repoContentQuery(owner, name, DEFAULT_REVISION, ''));
    client.prefetchQuery(repoReadmeQuery(`${owner}/${name}`, DEFAULT_REVISION, ''));
    return;
  }
  client
    .fetchQuery(repoResolveQuery(owner, name, rest))
    .then((target) => target && client.prefetchQuery(repoContentQuery(owner, name, target.ref, target.path)))
    .catch(() => {}); // the page shows the error when it asks
}
