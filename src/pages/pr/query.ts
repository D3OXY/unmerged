import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { gql, rest } from '@/github/client';
import type { Actor, CheckState, IssueState, IssueStateReason, Label, PrState, ReviewDecision } from '@/github/types';
import { persisted } from '@/lib/persist';
import type { PrTab } from '@/lib/routes';
import type { Permission } from '@/pages/repo/query';
import { summarizeChecks } from './checks';
import type { PrFile } from './files/FileDiff';

// The head commit's checks, as the PR header, Conversation tab and merge box show them.
const ROLLUP = /* GraphQL */ `
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
`;

// Everything CommentBody needs to toggle reactions on a comment or the description.
const REACTIONS = 'viewerCanReact reactionGroups { content viewerHasReacted reactors { totalCount } }';
// An issue or pull request mentioned in the timeline or linked to close.
const ISSUE_REF = 'number title url state stateReason repository { nameWithOwner }';
const REF = `__typename ... on Issue { ${ISSUE_REF} } ... on PullRequest { number title url state repository { nameWithOwner } }`;

export const PR_QUERY = /* GraphQL */ `
  query PullRequest($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      nameWithOwner isPrivate
      mergeCommitAllowed squashMergeAllowed rebaseMergeAllowed autoMergeAllowed
      viewerDefaultMergeMethod viewerPermission
      pullRequest(number: $number) {
        id number title url state isDraft createdAt mergedAt closedAt bodyHTML body ${REACTIONS}
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
        viewerCanEnableAutoMerge viewerCanDisableAutoMerge viewerCanLabel viewerCanAssign
        mergeHeadline: viewerMergeHeadlineText(mergeType: MERGE)
        mergeBody: viewerMergeBodyText(mergeType: MERGE)
        squashHeadline: viewerMergeHeadlineText(mergeType: SQUASH)
        squashBody: viewerMergeBodyText(mergeType: SQUASH)
        labels(first: 20) { nodes { id name color } }
        assignees(first: 10) { nodes { id login avatarUrl } }
        closingIssuesReferences(first: 10) { nodes { ${ISSUE_REF} } }
        reviewRequests(first: 20) {
          nodes { requestedReviewer { __typename ... on User { login avatarUrl } ... on Team { name avatarUrl } ... on Bot { login avatarUrl } } }
        }
        latestOpinionatedReviews(first: 20) { nodes { state author { login avatarUrl ... on User { id } } } }
        viewerPendingReview: reviews(first: 1, states: PENDING) { nodes { id comments { totalCount } } }
        commits(last: 1) {
          totalCount
          nodes {
            commit {
              statusCheckRollup { ${ROLLUP} }
            }
          }
        }
        files(first: 100) { totalCount nodes { path additions deletions changeType } }
        reviewThreads(first: 50) {
          totalCount
          nodes {
            id isResolved isOutdated path line diffSide viewerCanResolve viewerCanUnresolve viewerCanReply
            comments(first: 30) {
              totalCount
              nodes { id author { login avatarUrl } bodyHTML body createdAt diffHunk state viewerCanUpdate viewerCanDelete ${REACTIONS} }
            }
          }
        }
        timelineItems(
          last: 100
          itemTypes: [
            ISSUE_COMMENT, PULL_REQUEST_REVIEW, PULL_REQUEST_COMMIT, MERGED_EVENT, CLOSED_EVENT, REOPENED_EVENT,
            HEAD_REF_FORCE_PUSHED_EVENT, LABELED_EVENT, REVIEW_REQUESTED_EVENT, READY_FOR_REVIEW_EVENT,
            CONVERT_TO_DRAFT_EVENT, HEAD_REF_DELETED_EVENT, RENAMED_TITLE_EVENT, CROSS_REFERENCED_EVENT, CONNECTED_EVENT,
            DISCONNECTED_EVENT, ASSIGNED_EVENT, UNASSIGNED_EVENT, UNLABELED_EVENT, REVIEW_DISMISSED_EVENT,
            AUTO_MERGE_ENABLED_EVENT, AUTO_MERGE_DISABLED_EVENT, BASE_REF_FORCE_PUSHED_EVENT
          ]
        ) {
          totalCount
          nodes {
            __typename
            ... on IssueComment { id author { login avatarUrl } bodyHTML body createdAt viewerCanUpdate viewerCanDelete ${REACTIONS} }
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
            ... on CrossReferencedEvent { id actor { login avatarUrl } createdAt source { ${REF} } }
            ... on ConnectedEvent { id actor { login avatarUrl } createdAt subject { ${REF} } }
            ... on DisconnectedEvent { id actor { login avatarUrl } createdAt subject { ${REF} } }
            ... on AssignedEvent { id actor { login avatarUrl } createdAt assignee { ... on Actor { login } } }
            ... on UnassignedEvent { id actor { login avatarUrl } createdAt assignee { ... on Actor { login } } }
            ... on UnlabeledEvent { id actor { login avatarUrl } createdAt label { name color } }
            ... on ReviewDismissedEvent { id actor { login avatarUrl } createdAt dismissalMessage review { author { login } } }
            ... on AutoMergeEnabledEvent { id actor { login avatarUrl } createdAt }
            ... on AutoMergeDisabledEvent { id actor { login avatarUrl } createdAt }
            ... on BaseRefForcePushedEvent { id actor { login avatarUrl } createdAt ref { name } }
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

export type ReactionContent = 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY' | 'CONFUSED' | 'HEART' | 'ROCKET' | 'EYES';
export type ReactionGroup = { content: ReactionContent; viewerHasReacted: boolean; reactors: { totalCount: number } };

/** The editable side of a comment or the PR description: its markdown source, permissions and reactions. */
export type CommentFields = {
  id: string;
  body: string;
  viewerCanUpdate: boolean;
  viewerCanDelete?: boolean;
  viewerCanReact: boolean;
  reactionGroups: ReactionGroup[];
};

export type IssueRef = {
  number: number;
  title: string;
  url: string;
  state: IssueState;
  stateReason: IssueStateReason | null;
  repository: { nameWithOwner: string };
};
/** An issue or pull request mentioned in, or linked to, this one. */
export type Reference =
  | ({ __typename: 'Issue' } & IssueRef)
  | { __typename: 'PullRequest'; number: number; title: string; url: string; state: PrState; repository: { nameWithOwner: string } };

type Event<T extends string, Extra = object> = { __typename: T; id: string; actor: Actor; createdAt: string } & Extra;

export type TimelineItem =
  | ({ __typename: 'IssueComment'; author: Actor; bodyHTML: string; createdAt: string } & CommentFields)
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
  | Event<'ReviewRequestedEvent', { requestedReviewer: { __typename: string; login?: string; name?: string } | null }>
  | Event<'CrossReferencedEvent', { source: Reference }>
  | Event<'ConnectedEvent', { subject: Reference }>
  | Event<'DisconnectedEvent', { subject: Reference }>
  | Event<'AssignedEvent', { assignee: { login: string } | null }>
  | Event<'UnassignedEvent', { assignee: { login: string } | null }>
  | Event<'UnlabeledEvent', { label: Label }>
  | Event<'ReviewDismissedEvent', { dismissalMessage: string | null; review: { author: { login: string } | null } | null }>
  | Event<'AutoMergeEnabledEvent'>
  | Event<'AutoMergeDisabledEvent'>
  | Event<'BaseRefForcePushedEvent', { ref: { name: string } | null }>;

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
  /** PENDING comments belong to the viewer's unsubmitted review; only the viewer sees them. */
  comments: {
    totalCount: number;
    nodes: ({ author: Actor; bodyHTML: string; createdAt: string; diffHunk: string; state: 'PENDING' | 'SUBMITTED' } & CommentFields)[];
  };
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
  body: string;
  viewerCanReact: boolean;
  reactionGroups: ReactionGroup[];
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
  viewerCanLabel: boolean;
  viewerCanAssign: boolean;
  mergeHeadline: string;
  mergeBody: string;
  squashHeadline: string;
  squashBody: string;
  labels: { nodes: (Label & { id: string })[] };
  assignees: { nodes: (NonNullable<Actor> & { id: string })[] };
  closingIssuesReferences: { nodes: IssueRef[] };
  reviewRequests: { nodes: { requestedReviewer: Reviewer | null }[] };
  latestOpinionatedReviews: { nodes: { state: ReviewState; author: (NonNullable<Actor> & { id?: string }) | null }[] };
  /**
   * Only its author can see a pending review, so this is the viewer's, wherever it was started. Missing from
   * results persisted before it was queried.
   */
  viewerPendingReview?: { nodes: { id: string; comments: { totalCount: number } }[] };
  commits: {
    totalCount: number;
    nodes: { commit: { statusCheckRollup: { state: CheckState; contexts: { nodes: CheckContext[] } } | null } }[];
  };
  files: { totalCount: number; nodes: { path: string; additions: number; deletions: number; changeType: string }[] };
  reviewThreads: { totalCount: number; nodes: ReviewThread[] };
  timelineItems: { totalCount: number; nodes: TimelineItem[] };
};

export type PrData = {
  repository: {
    nameWithOwner: string;
    isPrivate: boolean;
    mergeCommitAllowed: boolean;
    squashMergeAllowed: boolean;
    rebaseMergeAllowed: boolean;
    autoMergeAllowed: boolean;
    viewerDefaultMergeMethod: MergeMethod;
    /** Missing from a result stored before it was asked for. */
    viewerPermission?: Permission | null;
    pullRequest: PullRequest | null;
  } | null;
};

export type Repo = NonNullable<PrData['repository']>;

/** "owner/repo" of a pull request, for REST paths. */
export const repoPath = (pr: { url: string }) => new URL(pr.url).pathname.split('/').slice(1, 3).join('/');

// Mutations. Each returns only a clientMutationId (except `startReview`); the page refetches the PR afterwards.
const m = (name: string, input: string, args: string) =>
  `mutation ${name}(${args}) { ${name[0]!.toLowerCase()}${name.slice(1)}(input: ${input}) { clientMutationId } }`;

export const MUTATIONS = {
  addComment: m('AddComment', '{ subjectId: $id, body: $body }', '$id: ID!, $body: String!'),
  addReview: m('AddPullRequestReview', '{ pullRequestId: $id, event: $event, body: $body }', '$id: ID!, $event: PullRequestReviewEvent!, $body: String'),
  // A pending review collects line comments (`addReviewThread`) until `submitReview` sends them with one verdict.
  startReview: /* GraphQL */ `mutation StartReview($id: ID!, $oid: GitObjectID) {
    addPullRequestReview(input: { pullRequestId: $id, commitOID: $oid }) { pullRequestReview { id } }
  }`,
  addReviewThread: m(
    'AddPullRequestReviewThread',
    '{ pullRequestReviewId: $review, path: $path, line: $line, side: $side, startLine: $startLine, startSide: $startSide, body: $body }',
    '$review: ID!, $path: String!, $line: Int!, $side: DiffSide!, $startLine: Int, $startSide: DiffSide, $body: String!',
  ),
  submitReview: m('SubmitPullRequestReview', '{ pullRequestReviewId: $id, event: $event, body: $body }', '$id: ID!, $event: PullRequestReviewEvent!, $body: String'),
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

// ── Edits: reviewers, assignees, labels, title and description, comments, reactions ──
export const EDIT_MUTATIONS = {
  requestReviews: m('RequestReviews', '{ pullRequestId: $id, userIds: $ids, union: true }', '$id: ID!, $ids: [ID!]!'),
  addAssignees: m('AddAssigneesToAssignable', '{ assignableId: $id, assigneeIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  removeAssignees: m('RemoveAssigneesFromAssignable', '{ assignableId: $id, assigneeIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  addLabels: m('AddLabelsToLabelable', '{ labelableId: $id, labelIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  removeLabels: m('RemoveLabelsFromLabelable', '{ labelableId: $id, labelIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  updateTitle: m('UpdatePullRequest', '{ pullRequestId: $id, title: $title }', '$id: ID!, $title: String!'),
  updateBody: m('UpdatePullRequest', '{ pullRequestId: $id, body: $body }', '$id: ID!, $body: String!'),
  updateComment: m('UpdateIssueComment', '{ id: $id, body: $body }', '$id: ID!, $body: String!'),
  deleteComment: m('DeleteIssueComment', '{ id: $id }', '$id: ID!'),
  updateReviewComment: m('UpdatePullRequestReviewComment', '{ pullRequestReviewCommentId: $id, body: $body }', '$id: ID!, $body: String!'),
  deleteReviewComment: m('DeletePullRequestReviewComment', '{ id: $id }', '$id: ID!'),
  addReaction: m('AddReaction', '{ subjectId: $id, content: $content }', '$id: ID!, $content: ReactionContent!'),
  removeReaction: m('RemoveReaction', '{ subjectId: $id, content: $content }', '$id: ID!, $content: ReactionContent!'),
};

const prKey = (owner: string, repo: string, number: number) => [owner.toLowerCase(), repo.toLowerCase(), number] as const;

export const prQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    // The version keeps results persisted by an older build (missing newer fields) from rendering.
    // Bump it whenever PR_QUERY gains fields.
    queryKey: ['pr', 3, ...prKey(owner, repo, number)],
    queryFn: () => gql<PrData>(PR_QUERY, { owner, repo, number }, true),
    persister: persisted,
  });

const PR_STATUS_QUERY = /* GraphQL */ `
  query PullRequestStatus($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        state headRefOid mergeable mergeStateStatus isInMergeQueue
        mergeQueueEntry { position }
        commits(last: 1) { nodes { commit { statusCheckRollup { ${ROLLUP} } } } }
        timelineItems { totalCount }
      }
    }
  }
`;

type PrStatus = Pick<PullRequest, 'state' | 'headRefOid' | 'mergeable' | 'mergeStateStatus' | 'isInMergeQueue' | 'mergeQueueEntry'> & {
  commits: { nodes: PullRequest['commits']['nodes'] };
  timelineItems: { totalCount: number };
};

/** True while GitHub is still deciding something about an open PR: its checks, mergeability or queue spot. */
export const isSettling = (pr: PullRequest) =>
  pr.state === 'OPEN' &&
  (summarizeChecks(pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []).PENDING > 0 ||
    pr.mergeable === 'UNKNOWN' ||
    pr.isInMergeQueue);

/**
 * The few PR fields that change while CI runs, polled by PrPage instead of the full PR. Each result is
 * written into the cached full PR, so everything reading it (merge box, Checks tab icon) stays current. When
 * the head commit, state or timeline moved, the full PR is refetched instead.
 */
export const prStatusQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['pr-status', ...prKey(owner, repo, number)],
    queryFn: async ({ client, queryKey }) => {
      const { repository } = await gql<{ repository: { pullRequest: PrStatus | null } | null }>(PR_STATUS_QUERY, { owner, repo, number });
      const status = repository?.pullRequest ?? null;
      const previous = client.getQueryData<PrStatus | null>(queryKey);
      const full = prQuery(owner, repo, number).queryKey;
      const cached = client.getQueryData(full)?.repository;
      const pr = cached?.pullRequest;
      if (!status || !cached || !pr) return status;

      const { commits, timelineItems, ...fields } = status;
      // This counts every timeline item, the full PR only some kinds, so compare it with the last poll.
      const timelineMoved = previous && previous.timelineItems.totalCount !== timelineItems.totalCount;
      if (status.headRefOid !== pr.headRefOid || status.state !== pr.state || timelineMoved) {
        // A slow refetch can outlast one poll; let it finish rather than restart it.
        client.invalidateQueries({ queryKey: full }, { cancelRefetch: false });
      } else {
        // Keep the PR's own age, so this doesn't hold off its next refetch on focus or mount.
        const updatedAt = client.getQueryState(full)?.dataUpdatedAt;
        client.setQueryData(full, { repository: { ...cached, pullRequest: { ...pr, ...fields, commits: { ...pr.commits, nodes: commits.nodes } } } }, { updatedAt });
      }
      return status;
    },
  });

const FILES_PER_PAGE = 100;
const MAX_FILES = 3000; // GitHub lists no more than this

/**
 * Every changed file with its patch, at one head commit: a push changes the key, so the files never go stale
 * before then. All pages are requested at once (`changedFiles` says how many), and each goes into the cache
 * as soon as the pages before it are in, so the top of the list shows first. The query stays fetching until
 * the last page is in. Not persisted: patches are large.
 */
export const prFilesQuery = (owner: string, repo: string, pr: Pick<PullRequest, 'number' | 'headRefOid' | 'changedFiles'>) =>
  queryOptions({
    queryKey: ['pr-files', ...prKey(owner, repo, pr.number), pr.headRefOid],
    queryFn: async ({ client, queryKey }) => {
      const pages = Math.max(1, Math.ceil(Math.min(pr.changedFiles, MAX_FILES) / FILES_PER_PAGE));
      const requests = Array.from({ length: pages }, (_, i) =>
        rest<PrFile[]>(`/repos/${owner}/${repo}/pulls/${pr.number}/files?per_page=${FILES_PER_PAGE}&page=${i + 1}`),
      );
      // A failed page fails the query below; this only stops the pages after it from reporting as unhandled.
      for (const request of requests) request.catch(() => {});
      let files: PrFile[] = [];
      for (const request of requests) {
        files = [...files, ...(await request)];
        client.setQueryData(queryKey, files);
      }
      return files;
    },
    staleTime: Infinity,
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

// Just what the patches' cache key needs, in a fraction of the full pull request's time.
const PR_HEAD_QUERY = /* GraphQL */ `
  query PullRequestHead($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) { pullRequest(number: $number) { number headRefOid changedFiles } }
  }
`;

/** What a pull request URL will show, started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchPr(client: QueryClient, owner: string, repo: string, number: number, tab: PrTab) {
  client.prefetchQuery(prQuery(owner, repo, number));
  if (tab !== 'files') return;
  client.prefetchQuery(prViewedQuery(owner, repo, number));
  // Patches are keyed by the head commit; look it up on its own so they don't wait for the full pull request.
  gql<{ repository: { pullRequest: Pick<PullRequest, 'number' | 'headRefOid' | 'changedFiles'> | null } | null }>(PR_HEAD_QUERY, { owner, repo, number })
    .then(({ repository }) => repository?.pullRequest && client.prefetchQuery(prFilesQuery(owner, repo, repository.pullRequest)))
    .catch(() => {});
}
