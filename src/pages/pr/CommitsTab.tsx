import { useQuery } from '@tanstack/react-query';
import { gql } from '@/github/client';
import { COMMIT_ROW_FIELDS, CommitList, type CommitRowData } from '@/ui/CommitList';
import { Skeleton } from '@/ui/primitives';
import { repoPath, type PullRequest } from './query';

const COMMITS_QUERY = /* GraphQL */ `
  query PrCommits($id: ID!, $after: String) {
    node(id: $id) {
      ... on PullRequest {
        commits(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { commit { ...CommitRow } }
        }
      }
    }
  }
  ${COMMIT_ROW_FIELDS}
`;

type Page = { node: { commits: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { commit: CommitRowData }[] } } };

/** All commits of a PR (GitHub caps PRs at 250), oldest first. */
async function fetchCommits(id: string) {
  const commits: CommitRowData[] = [];
  let after: string | null = null;
  do {
    const page: Page = await gql<Page>(COMMITS_QUERY, { id, after });
    commits.push(...page.node.commits.nodes.map((n) => n.commit));
    after = page.node.commits.pageInfo.hasNextPage ? page.node.commits.pageInfo.endCursor : null;
  } while (after && commits.length < 250);
  return commits;
}

export function CommitsTab({ pr }: { pr: PullRequest }) {
  const { data, isPending, error } = useQuery({ queryKey: ['pr-commits', pr.id], queryFn: () => fetchCommits(pr.id) });

  if (error) return <p className="text-[13px] text-danger">{error.message}</p>;
  if (isPending) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="max-w-[960px]">
      <CommitList commits={data} nameWithOwner={repoPath(pr)} commitHref={(oid) => `${pr.url}/commits/${oid}`} />
    </div>
  );
}
