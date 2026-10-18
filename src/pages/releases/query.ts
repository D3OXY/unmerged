import { infiniteQueryOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql } from '@/github/client';
import type { Actor } from '@/github/types';
import { persisted } from '@/lib/persist';
import type { Route } from '@/lib/routes';
import type { ReactionGroup } from '@/pages/pr/query';
import { repoQuery } from '@/pages/repo/query';
import { encodePath } from '@/pages/repo/urls';

/** The start of every query on these pages. */
const releasesKey = (owner: string, name: string) => ['releases', owner.toLowerCase(), name.toLowerCase()] as const;

// GitHub adds nothing to the source archives' list (zip, tar.gz): they're built from the tag on download. A release
// with more than 100 assets lists the first 100.
const RELEASE_FIELDS = /* GraphQL */ `
  fragment ReleaseFields on Release {
    id name tagName url isDraft isPrerelease isLatest createdAt publishedAt descriptionHTML
    author { login avatarUrl }
    tagCommit { oid abbreviatedOid }
    releaseAssets(first: 100) { totalCount nodes { id name size downloadUrl updatedAt } }
    viewerCanReact reactionGroups { content viewerHasReacted reactors { totalCount } }
  }
`;

export type Asset = { id: string; name: string; size: number; downloadUrl: string; updatedAt: string };

export type Release = {
  id: string;
  name: string | null;
  tagName: string;
  url: string;
  isDraft: boolean;
  isPrerelease: boolean;
  isLatest: boolean;
  createdAt: string;
  publishedAt: string | null;
  descriptionHTML: string | null;
  author: Actor;
  tagCommit: { oid: string; abbreviatedOid: string } | null;
  releaseAssets: { totalCount: number; nodes: Asset[] };
  viewerCanReact: boolean;
  reactionGroups: ReactionGroup[];
};

// An annotated tag points at a Tag object, which points at the commit; a lightweight tag points at the commit.
const TAG_FIELDS = /* GraphQL */ `
  fragment TagRef on Ref {
    name
    target {
      __typename
      ... on Commit { ...TagCommit }
      ... on Tag { message tagger { name date user { login avatarUrl } } target { ... on Commit { ...TagCommit } } }
    }
  }
  fragment TagCommit on Commit { oid abbreviatedOid committedDate messageHeadline author { name user { login avatarUrl } } }
`;

type Person = { name: string | null; user: Actor };
type TagCommit = { oid: string; abbreviatedOid: string; committedDate: string; messageHeadline: string; author: Person | null };

export type TagRef = {
  name: string;
  target:
    | ({ __typename: 'Commit' } & TagCommit)
    | { __typename: 'Tag'; message: string; tagger: (Person & { date: string }) | null; target: Partial<TagCommit> }
    | { __typename: 'Tree' | 'Blob' };
};

/**
 * A tag as the pages show it, the same for both kinds: its commit (null when it tags something else), when it was
 * made and by whom (the tagger, else the commit's author and date), and an annotated tag's message.
 */
export type Tag = {
  name: string;
  commit: { oid: string; abbreviatedOid: string; messageHeadline: string } | null;
  date: string | null;
  by: Person | null;
  message: string | null;
};

const commitOf = (target: Partial<TagCommit>) => (target.oid ? { oid: target.oid, abbreviatedOid: target.abbreviatedOid!, messageHeadline: target.messageHeadline! } : null);

export function toTag({ name, target }: TagRef): Tag {
  if (target.__typename === 'Commit') return { name, commit: commitOf(target), date: target.committedDate, by: target.author, message: null };
  if (target.__typename === 'Tag') {
    const { tagger, target: inner } = target;
    return {
      name,
      commit: commitOf(inner),
      date: tagger?.date ?? inner.committedDate ?? null,
      by: tagger ? { name: tagger.name, user: tagger.user } : (inner.author ?? null),
      message: target.message.trim() || null,
    };
  }
  return { name, commit: null, date: null, by: null, message: null };
}

/** GitHub's source archive of a tag, which every release lists after its own assets. */
export const archiveUrl = (nwo: string, tag: string, type: 'zip' | 'tar.gz') => `https://github.com/${nwo}/archive/refs/tags/${encodePath(tag)}.${type}`;

/** The page of a release, or of a tag without one. */
export const releaseHref = (nwo: string, tag: string) => `/${nwo}/releases/tag/${encodePath(tag)}`;

type Page<T> = { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] };

const EMPTY = { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] };

// Ten a page, as GitHub's list has: bodies can be long.
const RELEASES_QUERY = /* GraphQL */ `
  query Releases($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      releases(first: 10, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { ...ReleaseFields }
      }
    }
  }
  ${RELEASE_FIELDS}
`;

/** A repo's releases, newest first, drafts included for those who can see them. */
export const releasesQuery = (owner: string, name: string) =>
  infiniteQueryOptions({
    queryKey: [...releasesKey(owner, name), 'list'],
    queryFn: async ({ pageParam, signal }): Promise<Page<Release>> =>
      (await gql<{ repository: { releases: Page<Release> } | null }>(RELEASES_QUERY, { owner, name, after: pageParam }, false, signal)).repository?.releases ?? EMPTY,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : null),
    persister: persisted<Page<Release>>,
  });

const TAGS_QUERY = /* GraphQL */ `
  query Tags($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      refs(refPrefix: "refs/tags/", first: 30, after: $after, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { ...TagRef }
      }
    }
  }
  ${TAG_FIELDS}
`;

/** A repo's tags, newest commit first as GitHub orders them, 30 at a time. */
export const tagsQuery = (owner: string, name: string) =>
  infiniteQueryOptions({
    queryKey: [...releasesKey(owner, name), 'tags'],
    queryFn: async ({ pageParam, signal }): Promise<Page<Tag>> => {
      const refs = (await gql<{ repository: { refs: Page<TagRef> } | null }>(TAGS_QUERY, { owner, name, after: pageParam }, false, signal)).repository?.refs ?? EMPTY;
      return { ...refs, nodes: refs.nodes.map(toTag) };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : null),
    persister: persisted<Page<Tag>>,
  });

const RELEASE_QUERY = /* GraphQL */ `
  query Release($owner: String!, $name: String!, $tag: String!, $ref: String!) {
    repository(owner: $owner, name: $name) {
      release(tagName: $tag) { ...ReleaseFields }
      ref(qualifiedName: $ref) { ...TagRef }
    }
  }
  ${RELEASE_FIELDS}
  ${TAG_FIELDS}
`;

const LATEST_QUERY = /* GraphQL */ `
  query LatestRelease($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) { release: latestRelease { ...ReleaseFields } }
  }
  ${RELEASE_FIELDS}
`;

/**
 * One release by its tag, or with no `tag` the latest. `tag` is the tag itself, so a tag without a release still
 * has a page; null for the latest, and when neither exists.
 */
export const releaseQuery = (owner: string, name: string, tag?: string) =>
  queryOptions({
    queryKey: [...releasesKey(owner, name), 'release', tag ?? null],
    queryFn: async ({ signal }): Promise<{ release: Release | null; tag: Tag | null }> => {
      if (!tag) {
        const data = await gql<{ repository: { release: Release | null } | null }>(LATEST_QUERY, { owner, name }, false, signal);
        return { release: data.repository?.release ?? null, tag: null };
      }
      type Data = { repository: { release: Release | null; ref: TagRef | null } | null };
      const data = await gql<Data>(RELEASE_QUERY, { owner, name, tag, ref: `refs/tags/${tag}` }, false, signal);
      const ref = data.repository?.ref;
      return { release: data.repository?.release ?? null, tag: ref ? toTag(ref) : null };
    },
    persister: persisted,
  });

/** What a releases, tags or release URL shows first, started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchReleases(client: QueryClient, route: Extract<Route, { kind: 'releases' | 'release' }>) {
  client.prefetchQuery(repoQuery(route.owner, route.repo));
  if (route.kind === 'release') client.prefetchQuery(releaseQuery(route.owner, route.repo, route.tag));
  else if (route.tab === 'tags') client.prefetchInfiniteQuery(tagsQuery(route.owner, route.repo));
  else client.prefetchInfiniteQuery(releasesQuery(route.owner, route.repo));
}
