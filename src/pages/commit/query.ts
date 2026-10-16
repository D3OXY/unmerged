import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql, rest } from '@/github/client';
import { persisted } from '@/lib/persist';
import type { PrFile } from '@/pages/pr/files/FileDiff';
import { COMMIT_ROW_FIELDS, type CommitRowData } from '@/ui/CommitList';

// The header: message, people, parents and checks. The files come from REST (patches), in parallel.
const COMMIT_QUERY = /* GraphQL */ `
  query Commit($owner: String!, $repo: String!, $sha: String!, $number: Int!, $inPr: Boolean!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $sha) {
        ... on Commit {
          ...CommitRow
          authoredDate changedFilesIfAvailable
          committer { name user { login avatarUrl } }
          parents(first: 5) { totalCount nodes { oid abbreviatedOid } }
        }
      }
      pullRequest(number: $number) @include(if: $inPr) { title }
    }
  }
  ${COMMIT_ROW_FIELDS}
`;

export type Commit = CommitRowData & {
  authoredDate: string;
  changedFilesIfAvailable: number | null;
  committer: CommitRowData['author'];
  parents: { totalCount: number; nodes: { oid: string; abbreviatedOid: string }[] };
};

type CommitData = { repository: { object: Commit | null; pullRequest?: { title: string } | null } | null };

const key = (owner: string, repo: string, sha: string) => [owner.toLowerCase(), repo.toLowerCase(), sha.toLowerCase()] as const;

/** A commit's header; with `pr`, also that pull request's title (the commit was opened from it). */
export const commitQuery = (owner: string, repo: string, sha: string, pr?: number) =>
  queryOptions({
    queryKey: ['commit', ...key(owner, repo, sha), pr ?? null],
    queryFn: () => gql<CommitData>(COMMIT_QUERY, { owner, repo, sha, number: pr ?? 0, inPr: pr !== undefined }),
    persister: persisted,
  });

/**
 * Every changed file with its patch. GitHub pages a commit's files like a pull request's (100 per page, at
 * most 3000), repeating the rest of the commit on each page. A commit never changes, so neither does this.
 */
export const commitFilesQuery = (owner: string, repo: string, sha: string) =>
  queryOptions({
    queryKey: ['commit-files', ...key(owner, repo, sha)],
    queryFn: async () => {
      const files: PrFile[] = [];
      for (let page = 1; page <= 30; page++) {
        const { files: batch = [] } = await rest<{ files?: PrFile[] }>(`/repos/${owner}/${repo}/commits/${sha}?per_page=100&page=${page}`);
        files.push(...batch);
        if (batch.length < 100) break;
      }
      return files;
    },
    staleTime: Infinity,
    persister: persisted,
  });

/** What a commit URL will show, started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchCommit(client: QueryClient, owner: string, repo: string, sha: string, pr?: number) {
  client.prefetchQuery(commitQuery(owner, repo, sha, pr));
  client.prefetchQuery(commitFilesQuery(owner, repo, sha));
}
