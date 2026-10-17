import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Actor, PrState } from '@/github/types';
import { gql } from '@/github/client';
import { persisted } from '@/lib/persist';
import { createStore } from '@/lib/store';
import { repoQuery } from '@/pages/repo/query';
import type { CommitRowData } from '@/ui/CommitList';

/** The start of every query on this page, so a change to the repo's branches refreshes them all. */
export const branchesKey = (owner: string, name: string) => ['branches', owner.toLowerCase(), name.toLowerCase()] as const;

type Author = { name: string | null; user: Actor } | null;

/** A branch as the index knows it: enough to sort, filter and start its row. */
export type BranchEntry = { name: string; committedDate: string; author: Author };

// GitHub orders branches by name only (TAG_COMMIT_DATE applies to tags), so every branch is listed, cheaply, and
// sorted here. Listing stops at MAX_PAGES: a few repos have thousands of branches.
const INDEX_QUERY = /* GraphQL */ `
  query BranchIndex($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      refs(refPrefix: "refs/heads/", first: 100, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { name target { ... on Commit { committedDate author { name user { login avatarUrl } } } } }
      }
    }
  }
`;

const MAX_PAGES = 30;

/** Every branch's name, last commit and author, and how many the repo has (more than listed past MAX_PAGES). */
export type BranchIndex = { entries: BranchEntry[]; total: number };

/** How far each repo's index ("owner/name") has got while it loads, for the page's progress line. */
export const indexProgress = createStore<Record<string, { loaded: number; total: number }>>({});

/**
 * The index, listed 100 at a time and stored whole: a revisit paints the stored list at once and swaps in the new
 * one when it's complete (a page at a time, the stored list would be replaced by its first hundred).
 */
export const branchIndexQuery = (owner: string, name: string) =>
  queryOptions({
    queryKey: [...branchesKey(owner, name), 'index'],
    queryFn: async (): Promise<BranchIndex> => {
      type Node = { name: string; target: { committedDate: string; author: Author } };
      type Refs = { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Node[] };
      const id = `${owner}/${name}`.toLowerCase();
      const entries: BranchEntry[] = [];
      let total = 0;
      let after: string | null = null;
      try {
        for (let page = 0; page < MAX_PAGES; page++) {
          const refs: Refs | undefined = (await gql<{ repository: { refs: Refs } | null }>(INDEX_QUERY, { owner, name, after })).repository?.refs;
          total = refs?.totalCount ?? 0;
          entries.push(...(refs?.nodes.map((node) => ({ name: node.name, committedDate: node.target.committedDate, author: node.target.author })) ?? []));
          indexProgress.set({ ...indexProgress.get(), [id]: { loaded: entries.length, total } });
          if (!refs?.pageInfo.hasNextPage) break;
          after = refs.pageInfo.endCursor;
        }
      } finally {
        const others = { ...indexProgress.get() };
        delete others[id];
        indexProgress.set(others);
      }
      return { entries, total };
    },
    staleTime: 30_000,
    persister: persisted,
  });

/** GitHub's line between Active and Stale: a commit in the last three months. */
const STALE_AFTER = 90 * 86_400_000;

const isStale = (entry: BranchEntry, now = Date.now()) => now - Date.parse(entry.committedDate) > STALE_AFTER;

/**
 * The page's lists from the index. All is newest first; Yours (the last commit is `login`'s: GitHub goes by who
 * pushed, which the API doesn't say) and Active too, Stale oldest first, as GitHub orders them. Only All has the
 * default branch.
 */
export function branchLists(entries: BranchEntry[], defaultBranch: string | undefined, login: string | null, now = Date.now()) {
  const all = entries.toSorted((a, b) => Date.parse(b.committedDate) - Date.parse(a.committedDate));
  const others = all.filter((entry) => entry.name !== defaultBranch);
  const lower = login?.toLowerCase();
  return {
    all,
    yours: lower ? others.filter((entry) => entry.author?.user?.login.toLowerCase() === lower) : [],
    active: others.filter((entry) => !isStale(entry, now)),
    stale: others.filter((entry) => isStale(entry, now)).reverse(),
  };
}

// `compare` is from the branch to the default branch (HEAD): its aheadBy is how far the branch is *behind*.
const BRANCH_FIELDS = /* GraphQL */ `
  fragment BranchRow on Ref {
    id
    target {
      ... on Commit {
        oid
        statusCheckRollup {
          state
          contexts(first: 0) {
            checkRunCount checkRunCountsByState { state count }
            statusContextCount statusContextCountsByState { state count }
          }
        }
      }
    }
    associatedPullRequests(first: 1, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { number state isDraft } }
    compare(headRef: "HEAD") { aheadBy behindBy }
  }
`;

export type BranchNode = {
  id: string;
  target: { oid: string; statusCheckRollup: CommitRowData['statusCheckRollup'] };
  associatedPullRequests: { nodes: { number: number; state: PrState; isDraft: boolean }[] };
  compare: { aheadBy: number; behindBy: number } | null;
};

/** The rest of a branch's row: its last commit's checks, its latest pull request, and how it differs from the default branch. */
export type Branch = {
  id: string;
  oid: string;
  rollup: CommitRowData['statusCheckRollup'];
  pr: BranchNode['associatedPullRequests']['nodes'][number] | null;
  ahead: number;
  behind: number;
};

/** A row from GitHub's ref, with `compare` turned around to read from the branch's side. */
export const toBranch = ({ id, target, associatedPullRequests, compare }: BranchNode): Branch => ({
  id,
  oid: target.oid,
  rollup: target.statusCheckRollup,
  pr: associatedPullRequests.nodes[0] ?? null,
  ahead: compare?.behindBy ?? 0,
  behind: compare?.aheadBy ?? 0,
});

/** Rows are filled in this many at a time, one request each. */
export const DETAILS_BATCH = 20;

/** The rows of up to DETAILS_BATCH branches, by name; a branch deleted since it was listed is missing. */
export const branchDetailsQuery = (owner: string, name: string, names: string[]) =>
  queryOptions({
    queryKey: [...branchesKey(owner, name), 'details', ...names],
    queryFn: async (): Promise<Record<string, Branch>> => {
      const query = `query BranchRows($owner: String!, $name: String!, ${names.map((_, i) => `$n${i}: String!`).join(', ')}) {
        repository(owner: $owner, name: $name) { ${names.map((_, i) => `b${i}: ref(qualifiedName: $n${i}) { ...BranchRow }`).join(' ')} }
      }
      ${BRANCH_FIELDS}`;
      const variables = Object.fromEntries(names.map((n, i) => [`n${i}`, `refs/heads/${n}`]));
      const data = await gql<{ repository: Record<string, BranchNode | null> | null }>(query, { owner, name, ...variables });
      return Object.fromEntries(
        names.flatMap((n, i) => {
          const node = data.repository?.[`b${i}`];
          return node ? [[n, toBranch(node)]] : [];
        }),
      );
    },
    staleTime: 30_000,
    persister: persisted,
  });

const SOURCE_QUERY = /* GraphQL */ `
  query BranchSource($owner: String!, $name: String!, $expr: String!) {
    repository(owner: $owner, name: $name) {
      object(expression: $expr) { ... on Commit { oid } ... on Tag { target { oid } } }
    }
  }
`;

/** The commit a branch, tag or SHA names, for a new branch to start from; null if it names nothing. */
export async function resolveSource(owner: string, name: string, source: string) {
  type Data = { repository: { object: { oid?: string; target?: { oid: string } } | null } | null };
  const object = (await gql<Data>(SOURCE_QUERY, { owner, name, expr: source })).repository?.object;
  return object?.oid ?? object?.target?.oid ?? null;
}

export const BRANCH_MUTATIONS = {
  create: `mutation CreateBranch($repositoryId: ID!, $name: String!, $oid: GitObjectID!) { createRef(input: { repositoryId: $repositoryId, name: $name, oid: $oid }) { clientMutationId } }`,
  delete: `mutation DeleteBranch($id: ID!) { deleteRef(input: { refId: $id }) { clientMutationId } }`,
};

/** What a branches URL needs first, started early (page load, link hover) by src/app/prefetch.ts. Every tab shares the index. */
export function prefetchBranches(client: QueryClient, owner: string, name: string) {
  client.prefetchQuery(repoQuery(owner, name));
  client.prefetchQuery(branchIndexQuery(owner, name));
}
