import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Copy, FolderTree } from 'lucide-react';
import { gql } from '@/github/client';
import type { Actor, CheckState } from '@/github/types';
import { copy } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { fullDate, timeAgo } from '@/lib/time';
import { Avatar, Panel, SectionHeader, Skeleton } from '@/ui/primitives';
import { CheckIcon } from '@/ui/status';
import { repoPath, type PullRequest } from './query';

const COMMITS_QUERY = /* GraphQL */ `
  query PrCommits($id: ID!, $after: String) {
    node(id: $id) {
      ... on PullRequest {
        commits(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            commit {
              oid abbreviatedOid messageHeadline messageBody committedDate url additions deletions
              author { name user { login avatarUrl } }
              statusCheckRollup { state }
            }
          }
        }
      }
    }
  }
`;

type Commit = {
  oid: string;
  abbreviatedOid: string;
  messageHeadline: string;
  messageBody: string;
  committedDate: string;
  url: string;
  additions: number;
  deletions: number;
  author: { name: string | null; user: Actor } | null;
  statusCheckRollup: { state: CheckState } | null;
};

type Page = { node: { commits: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { commit: Commit }[] } } };

/** All commits of a PR (GitHub caps PRs at 250), oldest first. */
async function fetchCommits(id: string) {
  const commits: Commit[] = [];
  let after: string | null = null;
  do {
    const page: Page = await gql<Page>(COMMITS_QUERY, { id, after });
    commits.push(...page.node.commits.nodes.map((n) => n.commit));
    after = page.node.commits.pageInfo.hasNextPage ? page.node.commits.pageInfo.endCursor : null;
  } while (after && commits.length < 250);
  return commits;
}

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Commits grouped by day, Linear-style rows with expandable messages. */
export function CommitsTab({ pr }: { pr: PullRequest }) {
  const { data, isPending, error } = useQuery({ queryKey: ['pr-commits', pr.id], queryFn: () => fetchCommits(pr.id) });

  if (error) return <p className="text-[13px] text-danger">{error.message}</p>;
  if (isPending) return <Skeleton className="h-64 rounded-xl" />;

  const days = new Map<string, Commit[]>();
  for (const commit of data) {
    const day = dayFormat.format(new Date(commit.committedDate));
    days.set(day, [...(days.get(day) ?? []), commit]);
  }

  return (
    <div className="flex max-w-[960px] flex-col gap-6">
      {[...days].map(([day, commits]) => (
        <section key={day}>
          <SectionHeader title={day} count={commits.length} />
          <Panel className="overflow-hidden">
            {commits.map((commit) => (
              <CommitRow key={commit.oid} commit={commit} prUrl={pr.url} repoUrl={`/${repoPath(pr)}`} />
            ))}
          </Panel>
        </section>
      ))}
    </div>
  );
}

function CommitRow({ commit, prUrl, repoUrl }: { commit: Commit; prUrl: string; repoUrl: string }) {
  const [open, setOpen] = useState(false);
  const user = commit.author?.user;
  return (
    <div className="border-b border-line last:border-b-0">
      <div className="flex min-h-12 items-center gap-3 px-4 py-2">
        <Avatar src={user?.avatarUrl} size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a href={`${prUrl}/commits/${commit.oid}`} data-row className="truncate text-[13px] font-medium hover:underline focus:underline focus:outline-none">
              {commit.messageHeadline}
            </a>
            {commit.messageBody && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Show full message"
                className="flex h-5 cursor-pointer items-center rounded px-1 text-subtle hover:bg-hover hover:text-fg"
              >
                <ChevronDown className={cx('size-3.5 transition-transform', open && 'rotate-180')} />
              </button>
            )}
          </div>
          <div className="text-[12px] text-subtle">
            <span className="text-muted">{user?.login ?? commit.author?.name}</span> committed{' '}
            <span title={fullDate(commit.committedDate)}>{timeAgo(commit.committedDate)}</span>
          </div>
        </div>
        <span className="hidden font-mono text-[11.5px] tabular-nums sm:block">
          <span className="text-success">+{commit.additions}</span> <span className="text-danger">−{commit.deletions}</span>
        </span>
        <span className="flex w-4 justify-center">
          <CheckIcon state={commit.statusCheckRollup?.state} />
        </span>
        <button
          type="button"
          onClick={() => copy(commit.oid, 'commit SHA')}
          title="Copy full SHA"
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-elevated px-2 font-mono text-[11.5px] text-muted hover:border-line-strong hover:text-fg"
        >
          {commit.abbreviatedOid}
          <Copy className="size-3" />
        </button>
        <a href={`${repoUrl}/tree/${commit.oid}`} title="Browse files at this commit" className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
          <FolderTree className="size-3.5" />
        </a>
      </div>
      {open && (
        <pre className="mx-4 mb-3 ml-[50px] animate-enter rounded-lg bg-elevated px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">
          {commit.messageBody}
        </pre>
      )}
    </div>
  );
}
