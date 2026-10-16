import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql, rest } from '@/github/client';
import type { Actor, CheckState, Label, PrState, ReviewDecision } from '@/github/types';
import { persisted } from '@/lib/persist';
import type { PrTab } from '@/lib/routes';
import { summarizeChecks } from './checks';
import type { PrFile } from './files/FileDiff';

export const PR_QUERY = /* GraphQL */ `
  query PullRequest($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      nameWithOwner
      mergeCommitAllowed squashMergeAllowed rebaseMergeAllowed autoMergeAllowed
      viewerDefaultMergeMethod
      pullRequest(number: $number) {
        id number title url state isDraft createdAt mergedAt closedAt bodyHTML
        author { login avatarUrl }
        baseRefName headRefName headRefOid isCrossRepository
        headRepositoryOwner { login }
        headRef { id }
        additions deletions changedFiles
        mergeable mergeStateStatus reviewDecision
        isMergeQueueEnabled isInMergeQueue
        mergeQueueEntry { position }
        autoMergeRequest { mergeMethod enabledBy { login } }
        mergedBy { login avatarUrl }
        viewerDidAuthor viewerCanUpdate viewerCanMergeAsAdmin viewerCanUpdateBranch
        viewerCanEnableAutoMerge viewerCanDisableAutoMerge
        mergeHeadline: viewerMergeHeadlineText(mergeType: MERGE)
        mergeBody: viewerMergeBodyText(mergeType: MERGE)
        squashHeadline: viewerMergeHeadlineText(mergeType: SQUASH)
        squashBody: viewerMergeBodyText(mergeType: SQUASH)
        labels(first: 20) { nodes { name color } }
        assignees(first: 10) { nodes { login avatarUrl } }
        reviewRequests(first: 20) {
          nodes { requestedReviewer { __typename ... on User { login avatarUrl } ... on Team { name avatarUrl } ... on Bot { login avatarUrl } } }
        }
        latestOpinionatedReviews(first: 20) { nodes { state author { login avatarUrl } } }
        commits(last: 1) {
          totalCount
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      id name status conclusion detailsUrl
                      isRequired(pullRequestNumber: $number)
                      checkSuite { app { name logoUrl } workflowRun { workflow { name } } }
                    }
                    ... on StatusContext {
                      id context state targetUrl description avatarUrl
                      isRequired(pullRequestNumber: $number)
                    }
                  }
                }
              }
            }
          }
        }
        files(first: 100) { totalCount nodes { path additions deletions changeType } }
        reviewThreads(first: 50) {
          nodes {
            id isResolved isOutdated path line diffSide viewerCanResolve viewerCanUnresolve viewerCanReply
            comments(first: 30) { nodes { id author { login avatarUrl } bodyHTML createdAt diffHunk } }
          }
        }
        timelineItems(
          last: 100
          itemTypes: [
            ISSUE_COMMENT, PULL_REQUEST_REVIEW, PULL_REQUEST_COMMIT, MERGED_EVENT, CLOSED_EVENT, REOPENED_EVENT,
            HEAD_REF_FORCE_PUSHED_EVENT, LABELED_EVENT, REVIEW_REQUESTED_EVENT, READY_FOR_REVIEW_EVENT,
            CONVERT_TO_DRAFT_EVENT, HEAD_REF_DELETED_EVENT, RENAMED_TITLE_EVENT
          ]
        ) {
          totalCount
          nodes {
            __typename
            ... on IssueComment { id author { login avatarUrl } bodyHTML createdAt }
            ... on PullRequestReview { id author { login avatarUrl } state bodyHTML submittedAt createdAt }
            ... on PullRequestCommit {
              id
              commit { oid abbreviatedOid messageHeadline committedDate url author { name user { login avatarUrl } } statusCheckRollup { state } }
            }
            ... on MergedEvent { id actor { login avatarUrl } createdAt commit { abbreviatedOid } mergeRefName }
            ... on ClosedEvent { id actor { login avatarUrl } createdAt }
            ... on ReopenedEvent { id actor { login avatarUrl } createdAt }
            ... on HeadRefForcePushedEvent { id actor { login avatarUrl } createdAt }
            ... on HeadRefDeletedEvent { id actor { login avatarUrl } createdAt }
            ... on ReadyForReviewEvent { id actor { login avatarUrl } createdAt }
            ... on ConvertToDraftEvent { id actor { login avatarUrl } createdAt }
            ... on LabeledEvent { id actor { login avatarUrl } createdAt label { name color } }
            ... on RenamedTitleEvent { id actor { login avatarUrl } createdAt previousTitle currentTitle }
            ... on ReviewRequestedEvent {
              id actor { login avatarUrl } createdAt
              requestedReviewer { __typename ... on User { login } ... on Team { name } ... on Bot { login } }
            }
          }
        }
      }
    }
  }
`;

export type MergeMethod = 'MERGE' | 'SQUASH' | 'REBASE';
export type MergeStateStatus = 'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'DRAFT' | 'HAS_HOOKS' | 'UNKNOWN' | 'UNSTABLE';
export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';

export type CheckContext =
  | {
      __typename: 'CheckRun';
      id: string;
      name: string;
      status: string;
      conclusion: string | null;
      detailsUrl: string | null;
      isRequired: boolean;
      checkSuite: { app: { name: string; logoUrl: string } | null; workflowRun: { workflow: { name: string } } | null } | null;
    }
  | {
      __typename: 'StatusContext';
      id: string;
      context: string;
      state: CheckState;
      targetUrl: string | null;
      description: string | null;
      avatarUrl: string | null;
      isRequired: boolean;
    };

type Reviewer =
  | { __typename: 'User' | 'Bot'; login: string; avatarUrl: string }
  | { __typename: 'Team'; name: string; avatarUrl: string | null }
  | { __typename: 'Mannequin' };

type Event<T extends string, Extra = object> = { __typename: T; id: string; actor: Actor; createdAt: string } & Extra;

export type TimelineItem =
  | { __typename: 'IssueComment'; id: string; author: Actor; bodyHTML: string; createdAt: string }
  | { __typename: 'PullRequestReview'; id: string; author: Actor; state: ReviewState; bodyHTML: string; submittedAt: string | null; createdAt: string }
  | {
      __typename: 'PullRequestCommit';
      id: string;
      commit: {
        oid: string;
        abbreviatedOid: string;
        messageHeadline: string;
        committedDate: string;
        url: string;
        author: { name: string | null; user: Actor } | null;
        statusCheckRollup: { state: CheckState } | null;
      };
    }
  | Event<'MergedEvent', { commit: { abbreviatedOid: string } | null; mergeRefName: string }>
  | Event<'ClosedEvent'>
  | Event<'ReopenedEvent'>
  | Event<'HeadRefForcePushedEvent'>
  | Event<'HeadRefDeletedEvent'>
  | Event<'ReadyForReviewEvent'>
  | Event<'ConvertToDraftEvent'>
  | Event<'LabeledEvent', { label: Label }>
  | Event<'RenamedTitleEvent', { previousTitle: string; currentTitle: string }>
  | Event<'ReviewRequestedEvent', { requestedReviewer: { __typename: string; login?: string; name?: string } | null }>;

export type ReviewThread = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  diffSide: 'LEFT' | 'RIGHT';
  viewerCanResolve: boolean;
  viewerCanUnresolve: boolean;
  viewerCanReply: boolean;
  comments: { nodes: { id: string; author: Actor; bodyHTML: string; createdAt: string; diffHunk: string }[] };
};

export type PullRequest = {
  id: string;
  number: number;
  title: string;
  url: string;
  state: PrState;
  isDraft: boolean;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  bodyHTML: string;
  author: Actor;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  isCrossRepository: boolean;
  headRepositoryOwner: { login: string } | null;
  headRef: { id: string } | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  mergeStateStatus: MergeStateStatus;
  reviewDecision: ReviewDecision;
  isMergeQueueEnabled: boolean;
  isInMergeQueue: boolean;
  mergeQueueEntry: { position: number } | null;
  autoMergeRequest: { mergeMethod: MergeMethod; enabledBy: Actor } | null;
  mergedBy: Actor;
  viewerDidAuthor: boolean;
  viewerCanUpdate: boolean;
  viewerCanMergeAsAdmin: boolean;
  viewerCanUpdateBranch: boolean;
  viewerCanEnableAutoMerge: boolean;
  viewerCanDisableAutoMerge: boolean;
  mergeHeadline: string;
  mergeBody: string;
  squashHeadline: string;
  squashBody: string;
  labels: { nodes: Label[] };
  assignees: { nodes: NonNullable<Actor>[] };
  reviewRequests: { nodes: { requestedReviewer: Reviewer | null }[] };
  latestOpinionatedReviews: { nodes: { state: ReviewState; author: Actor }[] };
  commits: {
    totalCount: number;
    nodes: { commit: { statusCheckRollup: { state: CheckState; contexts: { nodes: CheckContext[] } } | null } }[];
  };
  files: { totalCount: number; nodes: { path: string; additions: number; deletions: number; changeType: string }[] };
  reviewThreads: { nodes: ReviewThread[] };
  timelineItems: { totalCount: number; nodes: TimelineItem[] };
};

export type PrData = {
  repository: {
    nameWithOwner: string;
    mergeCommitAllowed: boolean;
    squashMergeAllowed: boolean;
    rebaseMergeAllowed: boolean;
    autoMergeAllowed: boolean;
    viewerDefaultMergeMethod: MergeMethod;
    pullRequest: PullRequest | null;
  } | null;
};

export type Repo = NonNullable<PrData['repository']>;

/** "owner/repo" of a pull request, for REST paths. */
export const repoPath = (pr: { url: string }) => new URL(pr.url).pathname.split('/').slice(1, 3).join('/');

// Mutations. Each returns only a clientMutationId; the page refetches the PR afterwards.
const m = (name: string, input: string, args: string) =>
  `mutation ${name}(${args}) { ${name[0]!.toLowerCase()}${name.slice(1)}(input: ${input}) { clientMutationId } }`;

export const MUTATIONS = {
  addComment: m('AddComment', '{ subjectId: $id, body: $body }', '$id: ID!, $body: String!'),
  addReview: m('AddPullRequestReview', '{ pullRequestId: $id, event: $event, body: $body }', '$id: ID!, $event: PullRequestReviewEvent!, $body: String'),
  merge: m(
    'MergePullRequest',
    '{ pullRequestId: $id, mergeMethod: $method, commitHeadline: $headline, commitBody: $body, expectedHeadOid: $oid }',
    '$id: ID!, $method: PullRequestMergeMethod!, $headline: String, $body: String, $oid: GitObjectID',
  ),
  enableAutoMerge: m(
    'EnablePullRequestAutoMerge',
    '{ pullRequestId: $id, mergeMethod: $method, commitHeadline: $headline, commitBody: $body }',
    '$id: ID!, $method: PullRequestMergeMethod!, $headline: String, $body: String',
  ),
  disableAutoMerge: m('DisablePullRequestAutoMerge', '{ pullRequestId: $id }', '$id: ID!'),
  enqueue: m('EnqueuePullRequest', '{ pullRequestId: $id, expectedHeadOid: $oid }', '$id: ID!, $oid: GitObjectID'),
  dequeue: m('DequeuePullRequest', '{ id: $id }', '$id: ID!'),
  updateBranch: m('UpdatePullRequestBranch', '{ pullRequestId: $id }', '$id: ID!'),
  readyForReview: m('MarkPullRequestReadyForReview', '{ pullRequestId: $id }', '$id: ID!'),
  convertToDraft: m('ConvertPullRequestToDraft', '{ pullRequestId: $id }', '$id: ID!'),
  close: m('ClosePullRequest', '{ pullRequestId: $id }', '$id: ID!'),
  reopen: m('ReopenPullRequest', '{ pullRequestId: $id }', '$id: ID!'),
  deleteBranch: m('DeleteRef', '{ refId: $id }', '$id: ID!'),
  resolveThread: m('ResolveReviewThread', '{ threadId: $id }', '$id: ID!'),
  unresolveThread: m('UnresolveReviewThread', '{ threadId: $id }', '$id: ID!'),
  markViewed: m('MarkFileAsViewed', '{ pullRequestId: $id, path: $path }', '$id: ID!, $path: String!'),
  unmarkViewed: m('UnmarkFileAsViewed', '{ pullRequestId: $id, path: $path }', '$id: ID!, $path: String!'),
  replyToThread: m('AddPullRequestReviewThreadReply', '{ pullRequestReviewThreadId: $id, body: $body }', '$id: ID!, $body: String!'),
};

const prKey = (owner: string, repo: string, number: number) => [owner.toLowerCase(), repo.toLowerCase(), number] as const;

export const prQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['pr', ...prKey(owner, repo, number)],
    queryFn: () => gql<PrData>(PR_QUERY, { owner, repo, number }, true),
    // Poll while GitHub is still deciding something (checks, mergeability, queue).
    refetchInterval: (query) => {
      const pr = query.state.data?.repository?.pullRequest;
      if (!pr || pr.state !== 'OPEN') return false;
      const pending = summarizeChecks(pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []).PENDING > 0;
      return pending || pr.mergeable === 'UNKNOWN' || pr.isInMergeQueue ? 10_000 : false;
    },
    persister: persisted,
  });

/** Every changed file with its patch. GitHub serves at most 3000 files, 100 per page. */
export const prFilesQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['pr-files', ...prKey(owner, repo, number)],
    queryFn: async () => {
      const files: PrFile[] = [];
      for (let page = 1; page <= 30; page++) {
        const batch = await rest<PrFile[]>(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`);
        files.push(...batch);
        if (batch.length < 100) break;
      }
      return files;
    },
    staleTime: 60_000,
    persister: persisted,
  });

const VIEWED_QUERY = /* GraphQL */ `
  query PrViewed($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        files(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { path viewerViewedState } }
      }
    }
  }
`;

export type ViewedState = 'VIEWED' | 'UNVIEWED' | 'DISMISSED';
type ViewedPage = {
  repository: {
    pullRequest: { files: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { path: string; viewerViewedState: ViewedState }[] } } | null;
  } | null;
};

/** The viewer's "Viewed" marks, shared with GitHub. */
export const prViewedQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['pr-viewed', ...prKey(owner, repo, number)],
    queryFn: async () => {
      const viewed: Record<string, ViewedState> = {};
      let after: string | null = null;
      do {
        const page: ViewedPage = await gql<ViewedPage>(VIEWED_QUERY, { owner, repo, number, after });
        const files = page.repository?.pullRequest?.files;
        for (const file of files?.nodes ?? []) viewed[file.path] = file.viewerViewedState;
        after = files?.pageInfo.hasNextPage ? files.pageInfo.endCursor : null;
      } while (after);
      return viewed;
    },
    persister: persisted,
  });

/** What a pull request URL will show, started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchPr(client: QueryClient, owner: string, repo: string, number: number, tab: PrTab) {
  client.prefetchQuery(prQuery(owner, repo, number));
  if (tab === 'files') {
    client.prefetchQuery(prFilesQuery(owner, repo, number));
    client.prefetchQuery(prViewedQuery(owner, repo, number));
  }
}
