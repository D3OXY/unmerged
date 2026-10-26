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
// What a comment's header and its menu need: its link, the author's role, an edit mark, and hiding.
const COMMENT_META = 'url authorAssociation lastEditedAt isMinimized minimizedReason viewerCanMinimize viewerCanUnminimize';

// A pull request loads in four parts, asked for at once. GitHub resolves a query's fields one after another, so
// four small queries finish sooner than one big one, and the page paints as soon as the first part is in.
const prPart = (name: string, repoFields: string, prFields: string) => /* GraphQL */ `
  query ${name}($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      ${repoFields}
      pullRequest(number: $number) { ${prFields} }
    }
  }
`;

// The header and the description: what every tab shows first.
const PR_HEAD_QUERY = prPart(
  'PullRequest',
  'nameWithOwner isPrivate',
  `id number title url state isDraft createdAt viewerCanUpdate viewerCanEditFiles bodyHTML body lastEditedAt ${REACTIONS}
  author { login avatarUrl }
  baseRefName headRefName headRefOid isCrossRepository
  headRepositoryOwner { login }
  headRepository { id nameWithOwner }
  additions deletions changedFiles
  commits(last: 1) { totalCount nodes { commit { statusCheckRollup { state contexts(first: 100) { nodes { __typename } } } } } }`,
);

// The merge box and the checks.
const PR_MERGE_QUERY = prPart(
  'PullRequestMerge',
  'mergeCommitAllowed squashMergeAllowed rebaseMergeAllowed autoMergeAllowed viewerDefaultMergeMethod viewerPermission',
  `mergedAt closedAt headRef { id } viewerCanDeleteHeadRef
  mergeable mergeStateStatus reviewDecision
  isMergeQueueEnabled isInMergeQueue
  mergeQueueEntry { position }
  autoMergeRequest { mergeMethod enabledBy { login } }
  mergedBy { login avatarUrl }
  viewerCanMergeAsAdmin viewerCanUpdateBranch viewerCanEnableAutoMerge viewerCanDisableAutoMerge
  mergeHeadline: viewerMergeHeadlineText(mergeType: MERGE)
  mergeBody: viewerMergeBodyText(mergeType: MERGE)
  squashHeadline: viewerMergeHeadlineText(mergeType: SQUASH)
  squashBody: viewerMergeBodyText(mergeType: SQUASH)
  commits(last: 1) { totalCount nodes { commit { statusCheckRollup { ${ROLLUP} } } } }`,
);

// Who reviews and what they said on lines, the linked issues, and the files.
const PR_REVIEW_QUERY = prPart(
  'PullRequestReview',
  '',
  `viewerDidAuthor viewerCanLabel viewerCanAssign viewerCanSubscribe viewerSubscription locked activeLockReason
  baseRepository { defaultBranchRef { name } }
  milestone { id title url }
  labels(first: 20) { nodes { id name color } }
  assignees(first: 10) { nodes { id login avatarUrl } }
  closingIssuesReferences(first: 10) { nodes { id ${ISSUE_REF} } }
  reviewRequests(first: 20) {
    nodes { requestedReviewer { __typename ... on User { login avatarUrl } ... on Team { name slug avatarUrl } ... on Bot { login avatarUrl } } }
  }
  latestOpinionatedReviews(first: 20) { nodes { state author { login avatarUrl ... on User { id } } } }
  viewerPendingReview: reviews(first: 1, states: PENDING) { nodes { id comments { totalCount } } }
  files(first: 100) { totalCount nodes { path additions deletions changeType } }
  reviewThreads(first: 50) {
    totalCount
    nodes {
      id isResolved isOutdated path line diffSide viewerCanResolve viewerCanUnresolve viewerCanReply
      comments(first: 30) {
        totalCount
        nodes { id author { login avatarUrl } bodyHTML body createdAt diffHunk state viewerCanUpdate viewerCanDelete ${REACTIONS} ${COMMENT_META} }
      }
    }
  }`,
);

// The activity: usually the slowest part.
const PR_TIMELINE_QUERY = prPart(
  'PullRequestTimeline',
  '',
  `timelineItems(
    last: 100
    itemTypes: [
      ISSUE_COMMENT, PULL_REQUEST_REVIEW, PULL_REQUEST_COMMIT, MERGED_EVENT, CLOSED_EVENT, REOPENED_EVENT,
      HEAD_REF_FORCE_PUSHED_EVENT, LABELED_EVENT, REVIEW_REQUESTED_EVENT, READY_FOR_REVIEW_EVENT,
      CONVERT_TO_DRAFT_EVENT, HEAD_REF_DELETED_EVENT, RENAMED_TITLE_EVENT, CROSS_REFERENCED_EVENT, CONNECTED_EVENT,
      DISCONNECTED_EVENT, ASSIGNED_EVENT, UNASSIGNED_EVENT, UNLABELED_EVENT, REVIEW_DISMISSED_EVENT,
      AUTO_MERGE_ENABLED_EVENT, AUTO_MERGE_DISABLED_EVENT, BASE_REF_FORCE_PUSHED_EVENT, BASE_REF_CHANGED_EVENT,
      REVIEW_REQUEST_REMOVED_EVENT, HEAD_REF_RESTORED_EVENT, MILESTONED_EVENT, DEMILESTONED_EVENT, LOCKED_EVENT,
      UNLOCKED_EVENT, ADDED_TO_MERGE_QUEUE_EVENT, REMOVED_FROM_MERGE_QUEUE_EVENT, REFERENCED_EVENT, DEPLOYED_EVENT
    ]
  ) {
    totalCount
    nodes {
      __typename
      ... on IssueComment { id author { login avatarUrl } bodyHTML body createdAt viewerCanUpdate viewerCanDelete ${REACTIONS} ${COMMENT_META} }
      ... on PullRequestReview { id author { login avatarUrl } state bodyHTML submittedAt createdAt url authorAssociation }
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
      ... on BaseRefChangedEvent { id actor { login avatarUrl } createdAt previousRefName currentRefName }
      ... on ReviewRequestRemovedEvent {
        id actor { login avatarUrl } createdAt
        requestedReviewer { __typename ... on User { login } ... on Team { name } ... on Bot { login } }
      }
      ... on HeadRefRestoredEvent { id actor { login avatarUrl } createdAt }
      ... on MilestonedEvent { id actor { login avatarUrl } createdAt milestoneTitle }
      ... on DemilestonedEvent { id actor { login avatarUrl } createdAt milestoneTitle }
      ... on LockedEvent { id actor { login avatarUrl } createdAt lockReason }
      ... on UnlockedEvent { id actor { login avatarUrl } createdAt }
      ... on AddedToMergeQueueEvent { id actor { login avatarUrl } createdAt }
      ... on RemovedFromMergeQueueEvent { id actor { login avatarUrl } createdAt reason }
      ... on ReferencedEvent { id actor { login avatarUrl } createdAt commit { abbreviatedOid messageHeadline url } }
      ... on DeployedEvent { id actor { login avatarUrl } createdAt deployment { environment } }
    }
  }`,
);

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
  | { __typename: 'Team'; name: string; slug: string; avatarUrl: string | null }
  | { __typename: 'Mannequin' };

/** The author's role in the repository, as GitHub labels a comment. */
export type AuthorAssociation = 'MEMBER' | 'OWNER' | 'MANNEQUIN' | 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIME_CONTRIBUTOR' | 'FIRST_TIMER' | 'NONE';

/** Why a comment is hidden: GitHub's `ReportedContentClassifiers`, in its own case (`minimizedReason` is lowercase). */
export type HideReason = 'SPAM' | 'ABUSE' | 'OFF_TOPIC' | 'OUTDATED' | 'DUPLICATE' | 'RESOLVED' | 'LOW_QUALITY';

/** A comment's link, its author's role, its last edit, and whether it is hidden. */
export type CommentMeta = {
  url: string;
  authorAssociation: AuthorAssociation;
  lastEditedAt: string | null;
  isMinimized: boolean;
  minimizedReason: string | null;
  viewerCanMinimize: boolean;
  viewerCanUnminimize: boolean;
};

export type LockReason = 'OFF_TOPIC' | 'TOO_HEATED' | 'RESOLVED' | 'SPAM';

export type ReactionContent = 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY' | 'CONFUSED' | 'HEART' | 'ROCKET' | 'EYES';
export type ReactionGroup = { content: ReactionContent; viewerHasReacted: boolean; reactors: { totalCount: number } };

/** The editable side of a comment or the PR description: its markdown source, permissions and reactions. */
export type CommentFields = {
  id: string;
  body: string;
  /** Where it shows on GitHub; its repository renders the edit's preview. */
  url?: string;
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
  | ({ __typename: 'IssueComment'; author: Actor; bodyHTML: string; createdAt: string } & CommentFields & CommentMeta)
  | {
      __typename: 'PullRequestReview';
      id: string;
      author: Actor;
      state: ReviewState;
      bodyHTML: string;
      submittedAt: string | null;
      createdAt: string;
      url: string;
      authorAssociation: AuthorAssociation;
    }
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
  | Event<'BaseRefForcePushedEvent', { ref: { name: string } | null }>
  | Event<'BaseRefChangedEvent', { previousRefName: string; currentRefName: string }>
  | Event<'ReviewRequestRemovedEvent', { requestedReviewer: { __typename: string; login?: string; name?: string } | null }>
  | Event<'HeadRefRestoredEvent'>
  | Event<'MilestonedEvent' | 'DemilestonedEvent', { milestoneTitle: string }>
  | Event<'LockedEvent', { lockReason: LockReason | null }>
  | Event<'UnlockedEvent'>
  | Event<'AddedToMergeQueueEvent'>
  | Event<'RemovedFromMergeQueueEvent', { reason: string | null }>
  | Event<'ReferencedEvent', { commit: { abbreviatedOid: string; messageHeadline: string; url: string } | null }>
  | Event<'DeployedEvent', { deployment: { environment: string | null } }>;

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
    nodes: ({ author: Actor; bodyHTML: string; createdAt: string; diffHunk: string; state: 'PENDING' | 'SUBMITTED' } & CommentFields & CommentMeta)[];
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
  lastEditedAt: string | null;
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
  /** The repository the head branch lives in: a fork's for a cross-repository PR. Null once that fork is deleted. */
  headRepository: { id: string; nameWithOwner: string } | null;
  headRef: { id: string } | null;
  viewerCanDeleteHeadRef: boolean;
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
  /** Whether the viewer can push to the head branch, so GitHub's editor can change its files. */
  viewerCanEditFiles: boolean;
  viewerCanMergeAsAdmin: boolean;
  viewerCanUpdateBranch: boolean;
  viewerCanEnableAutoMerge: boolean;
  viewerCanDisableAutoMerge: boolean;
  viewerCanLabel: boolean;
  viewerCanAssign: boolean;
  viewerCanSubscribe: boolean;
  viewerSubscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED' | null;
  locked: boolean;
  activeLockReason: LockReason | null;
  milestone: { id: string; title: string; url: string } | null;
  mergeHeadline: string;
  mergeBody: string;
  squashHeadline: string;
  squashBody: string;
  labels: { nodes: (Label & { id: string })[] };
  assignees: { nodes: (NonNullable<Actor> & { id: string })[] };
  closingIssuesReferences: { nodes: (IssueRef & { id: string })[] };
  baseRepository: { defaultBranchRef: { name: string } | null } | null;
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

// The fields of `PullRequest` that each part after the first brings. The first part brings `PrHead`.
type MergeFields =
  | 'mergedAt' | 'closedAt' | 'headRef' | 'viewerCanDeleteHeadRef' | 'mergeable' | 'mergeStateStatus' | 'reviewDecision' | 'isMergeQueueEnabled'
  | 'isInMergeQueue' | 'mergeQueueEntry' | 'autoMergeRequest' | 'mergedBy' | 'viewerCanMergeAsAdmin' | 'viewerCanUpdateBranch'
  | 'viewerCanEnableAutoMerge' | 'viewerCanDisableAutoMerge' | 'mergeHeadline' | 'mergeBody' | 'squashHeadline' | 'squashBody'
  | 'commits';
type ReviewFields =
  | 'viewerDidAuthor' | 'viewerCanLabel' | 'viewerCanAssign' | 'viewerCanSubscribe' | 'viewerSubscription' | 'locked'
  | 'activeLockReason' | 'baseRepository' | 'milestone' | 'labels' | 'assignees' | 'closingIssuesReferences'
  | 'reviewRequests' | 'latestOpinionatedReviews' | 'viewerPendingReview' | 'files' | 'reviewThreads';

/**
 * The first part of a pull request: the header and the description, which every tab shows first. Its checks
 * are only their states; the merge part brings them in full. The whole `PullRequest` is a `PrHead` too.
 */
export type PrHead = Omit<PullRequest, MergeFields | ReviewFields | 'timelineItems'> & {
  commits: { totalCount: number; nodes: { commit: { statusCheckRollup: { state: CheckState; contexts: { nodes: { __typename: string }[] } } | null } }[] };
};
/** The first part with the merge part: what the merge box needs. */
export type PrWithMerge = Omit<PullRequest, ReviewFields | 'timelineItems'>;
/** The first part with the review part: what the people card and the composer need. */
export type PrWithReview = Omit<PullRequest, MergeFields | 'timelineItems'>;

type RepoHead = { nameWithOwner: string; isPrivate: boolean };
type RepoMerge = {
  mergeCommitAllowed: boolean;
  squashMergeAllowed: boolean;
  rebaseMergeAllowed: boolean;
  autoMergeAllowed: boolean;
  viewerDefaultMergeMethod: MergeMethod;
  /** Missing from a result stored before it was asked for. */
  viewerPermission?: Permission | null;
};
export type Repo = RepoHead & RepoMerge;

/** What a part's query returns: some of the repository's fields and some of the pull request's. */
type Part<R, P> = { repository: (R & { pullRequest: P | null }) | null };
type HeadPart = Part<RepoHead, PrHead>;
type MergePart = Part<RepoMerge, Pick<PullRequest, MergeFields>>;
type ReviewPart = Part<object, Pick<PullRequest, ReviewFields>>;
type TimelinePart = Part<object, Pick<PullRequest, 'timelineItems'>>;

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
  updateBranch: m('UpdatePullRequestBranch', '{ pullRequestId: $id, updateMethod: $method }', '$id: ID!, $method: PullRequestBranchUpdateMethod'),
  readyForReview: m('MarkPullRequestReadyForReview', '{ pullRequestId: $id }', '$id: ID!'),
  convertToDraft: m('ConvertPullRequestToDraft', '{ pullRequestId: $id }', '$id: ID!'),
  close: m('ClosePullRequest', '{ pullRequestId: $id }', '$id: ID!'),
  reopen: m('ReopenPullRequest', '{ pullRequestId: $id }', '$id: ID!'),
  deleteBranch: m('DeleteRef', '{ refId: $id }', '$id: ID!'),
  restoreBranch: m('CreateRef', '{ repositoryId: $repo, name: $name, oid: $oid }', '$repo: ID!, $name: String!, $oid: GitObjectID!'),
  // Opens a pull request that reverts this merged one, and returns it.
  revert: /* GraphQL */ `mutation RevertPullRequest($id: ID!) {
    revertPullRequest(input: { pullRequestId: $id }) { revertPullRequest { url } }
  }`,
  discardReview: m('DeletePullRequestReview', '{ pullRequestReviewId: $id }', '$id: ID!'),
  resolveThread: m('ResolveReviewThread', '{ threadId: $id }', '$id: ID!'),
  unresolveThread: m('UnresolveReviewThread', '{ threadId: $id }', '$id: ID!'),
  markViewed: m('MarkFileAsViewed', '{ pullRequestId: $id, path: $path }', '$id: ID!, $path: String!'),
  unmarkViewed: m('UnmarkFileAsViewed', '{ pullRequestId: $id, path: $path }', '$id: ID!, $path: String!'),
  replyToThread: m('AddPullRequestReviewThreadReply', '{ pullRequestReviewThreadId: $id, body: $body }', '$id: ID!, $body: String!'),
};

// ── Edits: reviewers, assignees, labels, milestone, title, base and description, comments, reactions, notifications ──
export const EDIT_MUTATIONS = {
  requestReviews: m('RequestReviews', '{ pullRequestId: $id, userIds: $ids, union: true }', '$id: ID!, $ids: [ID!]!'),
  addAssignees: m('AddAssigneesToAssignable', '{ assignableId: $id, assigneeIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  removeAssignees: m('RemoveAssigneesFromAssignable', '{ assignableId: $id, assigneeIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  addLabels: m('AddLabelsToLabelable', '{ labelableId: $id, labelIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  removeLabels: m('RemoveLabelsFromLabelable', '{ labelableId: $id, labelIds: $ids }', '$id: ID!, $ids: [ID!]!'),
  updateTitle: m('UpdatePullRequest', '{ pullRequestId: $id, title: $title }', '$id: ID!, $title: String!'),
  updateBody: m('UpdatePullRequest', '{ pullRequestId: $id, body: $body }', '$id: ID!, $body: String!'),
  updateBase: m('UpdatePullRequest', '{ pullRequestId: $id, baseRefName: $base }', '$id: ID!, $base: String!'),
  // A null milestone removes it.
  updateMilestone: m('UpdatePullRequest', '{ pullRequestId: $id, milestoneId: $milestone }', '$id: ID!, $milestone: ID'),
  subscribe: m('UpdateSubscription', '{ subscribableId: $id, state: $state }', '$id: ID!, $state: SubscriptionState!'),
  lock: m('LockLockable', '{ lockableId: $id, lockReason: $reason }', '$id: ID!, $reason: LockReason'),
  unlock: m('UnlockLockable', '{ lockableId: $id }', '$id: ID!'),
  hideComment: m('MinimizeComment', '{ subjectId: $id, classifier: $reason }', '$id: ID!, $reason: ReportedContentClassifiers!'),
  unhideComment: m('UnminimizeComment', '{ subjectId: $id }', '$id: ID!'),
  updateComment: m('UpdateIssueComment', '{ id: $id, body: $body }', '$id: ID!, $body: String!'),
  deleteComment: m('DeleteIssueComment', '{ id: $id }', '$id: ID!'),
  updateReviewComment: m('UpdatePullRequestReviewComment', '{ pullRequestReviewCommentId: $id, body: $body }', '$id: ID!, $body: String!'),
  deleteReviewComment: m('DeletePullRequestReviewComment', '{ id: $id }', '$id: ID!'),
  addReaction: m('AddReaction', '{ subjectId: $id, content: $content }', '$id: ID!, $content: ReactionContent!'),
  removeReaction: m('RemoveReaction', '{ subjectId: $id, content: $content }', '$id: ID!, $content: ReactionContent!'),
};

const prKey = (owner: string, repo: string, number: number) => [owner.toLowerCase(), repo.toLowerCase(), number] as const;

/**
 * One part of a pull request, persisted, so a revisit shows every part at once. Each part's key starts with the
 * first part's key (`prQuery`), so invalidating that key refetches the whole pull request.
 */
const partQuery = <T>(query: string, owner: string, repo: string, number: number, ...part: [] | [string]) =>
  queryOptions({
    // The version keeps results persisted by an older build (missing newer fields) from rendering.
    // Bump it whenever a part gains fields.
    queryKey: ['pr', 6, ...prKey(owner, repo, number), ...part],
    queryFn: () => gql<T>(query, { owner, repo, number }, true),
    persister: persisted,
  });

/** The first part: the header and the description. Its key is the whole pull request's; mutations invalidate it. */
export const prQuery = (owner: string, repo: string, number: number) => partQuery<HeadPart>(PR_HEAD_QUERY, owner, repo, number);
export const prMergeQuery = (owner: string, repo: string, number: number) => partQuery<MergePart>(PR_MERGE_QUERY, owner, repo, number, 'merge');
export const prReviewQuery = (owner: string, repo: string, number: number) => partQuery<ReviewPart>(PR_REVIEW_QUERY, owner, repo, number, 'review');
export const prTimelineQuery = (owner: string, repo: string, number: number) =>
  partQuery<TimelinePart>(PR_TIMELINE_QUERY, owner, repo, number, 'timeline');

/**
 * What has loaded of a pull request, from its parts' results: the first part (`pr` and `repo`), each other part
 * joined to it once it is in, and `full` once every part is in. Undefined until the first part is in; null
 * when GitHub has no such pull request.
 */
export function joinPr(head: HeadPart | undefined, merge: MergePart | undefined, review: ReviewPart | undefined, timeline: TimelinePart | undefined) {
  if (!head) return undefined;
  if (!head.repository?.pullRequest) return null;
  const { pullRequest: pr, ...repo } = head.repository;
  let withMerge: { pr: PrWithMerge; repo: Repo } | undefined;
  if (merge?.repository?.pullRequest) {
    const { pullRequest, ...mergeRepo } = merge.repository;
    // After the first part, so the checks in full replace the first part's states.
    withMerge = { pr: { ...pr, ...pullRequest }, repo: { ...repo, ...mergeRepo } };
  }
  const reviewPr = review?.repository?.pullRequest;
  const withReview: PrWithReview | undefined = reviewPr ? { ...pr, ...reviewPr } : undefined;
  const timelineItems = timeline?.repository?.pullRequest?.timelineItems;
  const full =
    withMerge && reviewPr && timelineItems ? { pr: { ...withMerge.pr, ...reviewPr, timelineItems } satisfies PullRequest, repo: withMerge.repo } : undefined;
  return { pr, repo, merge: withMerge, review: withReview, timelineItems, full };
}
export type LoadedPr = NonNullable<ReturnType<typeof joinPr>>;

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

/** How often a PR's polls run after their first two minutes, such as during a long CI run. */
export const SLOW_POLL = 30_000;

/** True while GitHub is still deciding something about an open PR: its checks, mergeability or queue spot. */
export const isSettling = (pr: PrWithMerge) =>
  pr.state === 'OPEN' &&
  (summarizeChecks(pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []).PENDING > 0 ||
    pr.mergeable === 'UNKNOWN' ||
    pr.isInMergeQueue);

/**
 * The few PR fields that change while CI runs, polled by PrPage instead of the full PR. Each result is
 * written into the cached merge part, so everything reading it (merge box, Checks tab icon) stays current.
 * When the head commit, state or timeline moved, the whole PR is refetched instead.
 */
export const prStatusQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['pr-status', ...prKey(owner, repo, number)],
    queryFn: async ({ client, queryKey }) => {
      const { repository } = await gql<{ repository: { pullRequest: PrStatus | null } | null }>(PR_STATUS_QUERY, { owner, repo, number });
      const status = repository?.pullRequest ?? null;
      const previous = client.getQueryData<PrStatus | null>(queryKey);
      const full = prQuery(owner, repo, number).queryKey;
      const head = client.getQueryData(full)?.repository?.pullRequest;
      const merge = prMergeQuery(owner, repo, number).queryKey;
      const cached = client.getQueryData(merge)?.repository;
      const pr = cached?.pullRequest;
      if (!status || !head || !cached || !pr) return status;

      const { state, headRefOid, commits, timelineItems, ...fields } = status;
      // This counts every timeline item, the timeline part only some kinds, so compare it with the last poll.
      const timelineMoved = previous && previous.timelineItems.totalCount !== timelineItems.totalCount;
      if (headRefOid !== head.headRefOid || state !== head.state || timelineMoved) {
        // A slow refetch can outlast one poll; let it finish rather than restart it.
        client.invalidateQueries({ queryKey: full }, { cancelRefetch: false });
      } else {
        // Keep the part's own age, so this doesn't hold off its next refetch on focus or mount.
        const updatedAt = client.getQueryState(merge)?.dataUpdatedAt;
        client.setQueryData(merge, { repository: { ...cached, pullRequest: { ...pr, ...fields, commits: { ...pr.commits, nodes: commits.nodes } } } }, { updatedAt });
      }
      return status;
    },
  });

const FILES_PER_PAGE = 100;
export const MAX_FILES = 3000; // GitHub lists no more than this, on its own pages too

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

export type ViewedState = 'VIEWED' | 'UNVIEWED' | 'DISMISSED';
type FilesPage = { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { path: string; viewerViewedState: ViewedState }[] };

const VIEWED_PER_PAGE = 100; // GitHub's most per connection

/** GitHub's cursor after the first `count` files: the count in base64, unpadded. Opaque by contract, so checked before use. */
const filesCursor = (count: number) => btoa(String(count)).replace(/=+$/, '');

/** Pages of the viewer's file marks in one request, each starting after its cursor (null: at the first file). */
async function viewedPages(owner: string, repo: string, number: number, cursors: (string | null)[]) {
  const pages = cursors.map(
    (after, i) =>
      `p${i}: files(first: ${VIEWED_PER_PAGE}${after ? `, after: ${JSON.stringify(after)}` : ''}) { totalCount pageInfo { hasNextPage endCursor } nodes { path viewerViewedState } }`,
  );
  const query = `query PrViewed($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $number) { ${pages.join(' ')} } } }`;
  const { repository } = await gql<{ repository: { pullRequest: Record<string, FilesPage> | null } | null }>(query, { owner, repo, number });
  return cursors.map((_, i) => repository?.pullRequest?.[`p${i}`]);
}

/**
 * The viewer's "Viewed" marks, shared with GitHub. The first page tells how many files there are; every other
 * page then comes in one more request, so a PR with thousands of files costs two requests, not one per 100 files.
 */
export const prViewedQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['pr-viewed', ...prKey(owner, repo, number)],
    queryFn: async () => {
      const viewed: Record<string, ViewedState> = {};
      const add = (page: FilesPage | undefined) => {
        for (const file of page?.nodes ?? []) viewed[file.path] = file.viewerViewedState;
      };
      let [page] = await viewedPages(owner, repo, number, [null]);
      add(page);
      if (page?.pageInfo.hasNextPage && page.pageInfo.endCursor === filesCursor(VIEWED_PER_PAGE)) {
        const cursors: string[] = [];
        for (let count = VIEWED_PER_PAGE; count < page.totalCount; count += VIEWED_PER_PAGE) cursors.push(filesCursor(count));
        (await viewedPages(owner, repo, number, cursors)).forEach(add);
        return viewed;
      }
      // GitHub changed its cursors: follow them one page at a time.
      while (page?.pageInfo.hasNextPage) {
        [page] = await viewedPages(owner, repo, number, [page.pageInfo.endCursor]);
        add(page);
      }
      return viewed;
    },
    persister: persisted,
  });

/** What a pull request URL will show, started early (page load, link hover) by src/app/prefetch.ts. */
export function prefetchPr(client: QueryClient, owner: string, repo: string, number: number, tab: PrTab) {
  const head = client.fetchQuery(prQuery(owner, repo, number));
  head.catch(() => {});
  client.prefetchQuery(prMergeQuery(owner, repo, number));
  client.prefetchQuery(prReviewQuery(owner, repo, number));
  client.prefetchQuery(prTimelineQuery(owner, repo, number));
  if (tab !== 'files') return;
  client.prefetchQuery(prViewedQuery(owner, repo, number));
  // Patches are keyed by the head commit, which the first part brings.
  head.then(({ repository }) => repository?.pullRequest && client.prefetchQuery(prFilesQuery(owner, repo, repository.pullRequest))).catch(() => {});
}
