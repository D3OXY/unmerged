import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql, rest } from '@/github/client';
import { persisted } from '@/lib/persist';
import type { CompareRoute } from '@/lib/routes';
import type { PrFile } from '@/pages/pr/files/FileDiff';
import { DEFAULT_REVISION, repoQuery } from '@/pages/repo/query';
import { encodePath } from '@/pages/repo/urls';
import type { CommitRowData } from '@/ui/CommitList';

/** GitHub REST's comparison, as far as the page reads it. Commits come oldest first; files cap at 300. */
type RestComparison = {
  status: Comparison['status'];
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: {
    sha: string;
    author: { login: string; avatar_url: string } | null;
    commit: { message: string; author: { name: string } | null; committer: { date: string } | null; verification?: { verified: boolean } };
  }[];
  files?: PrFile[];
};

export type Comparison = {
  status: 'ahead' | 'behind' | 'identical' | 'diverged';
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  commits: CommitRowData[];
  files: PrFile[];
};

/** A ref in a URL path: segments encoded, its slashes and a fork's "owner:" kept. */
export const encodeRef = (ref: string) => encodePath(ref).replaceAll('%3A', ':');

/** The page comparing `base` (the default branch when missing) with `head`, with the create form open or not. */
export const compareHref = (nameWithOwner: string, base: string | undefined, head: string, expand: boolean) =>
  `/${nameWithOwner}/compare/${base ? `${encodeRef(base)}...` : ''}${encodeRef(head)}${expand ? '?expand=1' : ''}`;

/** Where a head ref lives: "branch" is in this repo, "owner:branch" in owner's fork of it, "owner:repo:branch" in a fork renamed. */
export function headRepo(head: string, owner: string, repo: string) {
  const parts = head.split(':'); // Refs can't contain ":".
  const branch = parts.pop() ?? '';
  return { owner: parts[0] ?? owner, repo: parts[1] ?? repo, branch, prefix: parts.map((p) => `${p}:`).join('') };
}

/**
 * Base vs head from the merge base, as a pull request would show it: commits and changed files with patches.
 * Stored for a cached first paint. REST rather than GraphQL: it takes any ref (tags, SHAs, forks) and lists
 * files in the same request.
 */
export const compareQuery = (owner: string, repo: string, base: string | undefined, head: string) =>
  queryOptions({
    queryKey: ['compare', owner.toLowerCase(), repo.toLowerCase(), base ?? null, head],
    queryFn: async (): Promise<Comparison> => {
      const data = await rest<RestComparison>(`/repos/${owner}/${repo}/compare/${encodeRef(base ?? DEFAULT_REVISION)}...${encodeRef(head)}`);
      return {
        status: data.status,
        aheadBy: data.ahead_by,
        behindBy: data.behind_by,
        totalCommits: data.total_commits,
        commits: data.commits.map(({ sha, author, commit }) => {
          const [headline = '', ...rest] = commit.message.split('\n');
          return {
            oid: sha,
            abbreviatedOid: sha.slice(0, 7),
            messageHeadline: headline,
            messageBody: rest.join('\n').trim(),
            committedDate: commit.committer?.date ?? '',
            author: { name: commit.author?.name ?? null, user: author && { login: author.login, avatarUrl: author.avatar_url } },
            signature: commit.verification ? { isValid: commit.verification.verified } : null,
            statusCheckRollup: null,
          };
        }),
        files: data.files ?? [],
      };
    },
    persister: persisted,
  });

const TEMPLATE_QUERY = /* GraphQL */ `
  query PrTemplates($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) { pullRequestTemplates { body } }
  }
`;

/** The repo's pull request template, when it has exactly one (with several, GitHub fills none in either). */
export const prTemplateQuery = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ['pr-template', owner.toLowerCase(), repo.toLowerCase()],
    queryFn: async () => {
      const data = await gql<{ repository: { pullRequestTemplates: { body: string | null }[] | null } | null }>(TEMPLATE_QUERY, { owner, name: repo });
      const templates = data.repository?.pullRequestTemplates ?? [];
      return templates.length === 1 ? (templates[0]?.body ?? null) : null;
    },
    staleTime: 10 * 60_000,
    persister: persisted,
  });

/**
 * A new pull request's title and body as GitHub starts them: one commit gives its message; more give the
 * head branch's name as a sentence ("fix/login-redirect" → "Fix/login redirect"). A template is the body.
 */
export function prefill(commits: CommitRowData[], head: string, template: string | null) {
  const only = commits.length === 1 ? commits[0] : undefined;
  const words = (head.split(':').pop() ?? '').replace(/[-_]+/g, ' ').trim();
  return {
    title: only?.messageHeadline ?? words.charAt(0).toUpperCase() + words.slice(1),
    body: template ?? only?.messageBody ?? '',
  };
}

/** `POST /repos/{owner}/{repo}/pulls`'s body. A renamed fork's head goes as "owner:branch" plus `head_repo`. */
export function newPullRequest({ owner, repo, base, head, title, body, draft }: { owner: string; repo: string; base: string; head: string; title: string; body: string; draft: boolean }) {
  const from = headRepo(head, owner, repo);
  const fork = from.prefix !== '';
  return {
    title,
    body,
    draft,
    base,
    head: fork ? `${from.owner}:${from.branch}` : head,
    ...(fork && from.repo !== repo && { head_repo: from.repo }),
  };
}

/** What a compare URL will show, started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchCompare(client: QueryClient, { owner, repo, base, head, expand }: CompareRoute) {
  client.prefetchQuery(repoQuery(owner, repo));
  if (head) client.prefetchQuery(compareQuery(owner, repo, base, head));
  if (head && expand) client.prefetchQuery(prTemplateQuery(owner, repo));
}
