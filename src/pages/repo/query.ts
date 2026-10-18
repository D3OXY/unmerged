import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql, restHtml } from '@/github/client';
import { absolutizeReadme } from '@/github/readme';
import { persisted } from '@/lib/persist';
import type { RepoView } from '@/lib/routes';
import { repoPulseItem } from '@/lib/settings';
import { repoChurnQuery, repoPulseQuery } from './pulse';
import { blobUrl, encodePath, rawUrl } from './urls';
import type { Actor, CheckState, Language } from '@/github/types';

export const REPO_QUERY = /* GraphQL */ `
  query Repo($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id name nameWithOwner description homepageUrl url sshUrl isPrivate isArchived isFork isTemplate isEmpty
      owner { login avatarUrl }
      parent { nameWithOwner }
      stargazerCount forkCount
      watchers { totalCount }
      viewerHasStarred viewerSubscription viewerCanAdminister viewerPermission
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

export type Permission = 'ADMIN' | 'MAINTAIN' | 'WRITE' | 'TRIAGE' | 'READ';

/** Whether a permission lets the viewer push: make and delete branches, draft and edit releases. */
export const canPushWith = (permission: Permission | null | undefined) => permission === 'ADMIN' || permission === 'MAINTAIN' || permission === 'WRITE';

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
  /** Missing from a result stored before it was asked for. */
  viewerPermission?: Permission | null;
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
 * Splits "<ref>/<path…>" segments into ref and path, and says whether that's a folder. Branch names may
 * contain slashes, so every split is tried in one request and the shortest ref that exists wins (GitHub does
 * the same).
 */
export async function resolveRefPath(owner: string, name: string, rest: string[]): Promise<{ ref: string; path: string; isTree: boolean } | null> {
  const candidates = rest.slice(0, 8).map((_, i) => ({ ref: rest.slice(0, i + 1).join('/'), path: rest.slice(i + 1).join('/') }));
  const query = `query Resolve($owner: String!, $name: String!, ${candidates.map((_, i) => `$e${i}: String!`).join(', ')}) {
    repository(owner: $owner, name: $name) { ${candidates.map((_, i) => `c${i}: object(expression: $e${i}) { __typename }`).join(' ')} }
  }`;
  const variables = Object.fromEntries(candidates.map((c, i) => [`e${i}`, `${c.ref}:${c.path}`]));
  const data = await gql<{ repository: Record<string, { __typename: string } | null> | null }>(query, { owner, name, ...variables });
  const index = candidates.findIndex((_, i) => data.repository?.[`c${i}`]);
  return index === -1 ? null : { ...candidates[index]!, isTree: data.repository?.[`c${index}`]?.__typename === 'Tree' };
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

/** Folders first, then by name, as a folder lists them. */
export const sortEntries = (entries: TreeEntry[]) => [...entries].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'tree' ? -1 : 1));

/**
 * Latest commit touching each of a folder's first 80 entries: one aliased `history` per path, in parallel
 * requests of 20, since GitHub resolves the fields of one request one after another.
 */
async function fetchEntryCommits(owner: string, name: string, ref: string, paths: string[]) {
  const list = paths.slice(0, 80);
  const chunks = Array.from({ length: Math.ceil(list.length / 20) }, (_, i) => list.slice(i * 20, (i + 1) * 20));
  const results = await Promise.all(chunks.map((chunk) => fetchEntryCommitsChunk(owner, name, ref, chunk)));
  return Object.fromEntries(results.flatMap((result) => Object.entries(result)));
}

async function fetchEntryCommitsChunk(owner: string, name: string, ref: string, list: string[]) {
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

const RECENT_PUSHES_QUERY = /* GraphQL */ `
  query RecentPushes($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      refs(refPrefix: "refs/heads/", first: 10, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
        nodes {
          name
          target { ... on Commit { committedDate author { user { login } } } }
          associatedPullRequests(states: OPEN, first: 1) { totalCount }
        }
      }
    }
  }
`;

type PushedRef = {
  name: string;
  target: { committedDate: string; author: { user: { login: string } | null } | null };
  associatedPullRequests: { totalCount: number };
};

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

/** The latest commit touching each of a folder's entries (by path), fetched once the entries are known. */
export const repoEntryCommitsQuery = (owner: string, name: string, revision: string, path: string, entries: TreeEntry[]) =>
  queryOptions({
    queryKey: ['repo-entry-commits', ...key(owner, name), revision, path],
    queryFn: () => fetchEntryCommits(owner, name, revision, sortEntries(entries).map((e) => e.path)),
    staleTime: 5 * 60_000,
    persister: persisted,
  });

/** GitHub-rendered Markdown with its URLs resolved as GitHub would: `dir` is the file's folder. */
const absolutize = (html: string, nameWithOwner: string, ref: string, dir: string) =>
  absolutizeReadme(html, rawUrl(nameWithOwner, ref, ''), `https://github.com${blobUrl(nameWithOwner, ref, '')}`, dir && `${encodePath(dir)}/`);

/** A folder's README, rendered by GitHub with links made absolute; null when there isn't one. */
export const repoReadmeQuery = (nameWithOwner: string, revision: string, path: string) =>
  queryOptions({
    queryKey: ['repo-readme', nameWithOwner.toLowerCase(), revision, path],
    queryFn: async () => {
      const at = revision === DEFAULT_REVISION ? '' : `?ref=${encodeURIComponent(revision)}`;
      const html = await restHtml(`/repos/${nameWithOwner}/readme/${encodePath(path)}${at}`);
      return html && absolutize(html, nameWithOwner, revision, path);
    },
    staleTime: 5 * 60_000,
    persister: persisted,
  });

/** A Markdown file rendered by GitHub with links made absolute (the blob view's preview). */
export const repoMarkdownQuery = (nameWithOwner: string, ref: string, path: string) =>
  queryOptions({
    queryKey: ['repo-markdown', nameWithOwner.toLowerCase(), ref, path],
    queryFn: async () => {
      const html = await restHtml(`/repos/${nameWithOwner}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
      return html && absolutize(html, nameWithOwner, ref, path.split('/').slice(0, -1).join('/'));
    },
    staleTime: 5 * 60_000,
  });

/** The viewer's (`login`) branches pushed in the last hour with no open pull request, newest first. */
export const recentPushesQuery = (owner: string, name: string, login: string) =>
  queryOptions({
    queryKey: ['repo-recent-pushes', ...key(owner, name), login],
    queryFn: async () => {
      const data = await gql<{ repository: { refs: { nodes: PushedRef[] } } | null }>(RECENT_PUSHES_QUERY, { owner, name });
      const since = Date.now() - 3_600_000;
      return (data.repository?.refs.nodes ?? [])
        .filter((ref) => ref.target.author?.user?.login === login && !ref.associatedPullRequests.totalCount && Date.parse(ref.target.committedDate) > since)
        .map((ref) => ({ name: ref.name, committedDate: ref.target.committedDate }));
    },
    staleTime: 60_000,
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
    repoPulseItem.getValue().then((show) => {
      if (!show) return;
      client.prefetchQuery(repoPulseQuery(owner, name));
      client.prefetchQuery(repoChurnQuery(owner, name));
    });
  }
  const resolved = rest.length ? client.fetchQuery(repoResolveQuery(owner, name, rest)) : Promise.resolve({ ref: DEFAULT_REVISION, path: '', isTree: true });
  resolved
    .then(async (target) => {
      if (!target) return;
      // A folder's README doesn't depend on its entries, so it's asked for alongside them.
      if (target.isTree) client.prefetchQuery(repoReadmeQuery(`${owner}/${name}`, target.ref, target.path));
      const object = (await client.fetchQuery(repoContentQuery(owner, name, target.ref, target.path))).repository?.object;
      if (object?.__typename === 'Tree') client.prefetchQuery(repoEntryCommitsQuery(owner, name, target.ref, target.path, object.entries));
    })
    .catch(() => {}); // the page shows the error when it asks
}
