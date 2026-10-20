import { queryOptions } from '@tanstack/react-query';
import { gql } from '@/github/client';
import type { Actor, IssueState, IssueStateReason, Label, PrState } from '@/github/types';
import { persisted } from '@/lib/persist';

const REF = /* GraphQL */ `
  fragment Ref on ReferencedSubject {
    __typename
    ... on Issue { number title url state stateReason repository { nameWithOwner } }
    ... on PullRequest { number title url state isDraft repository { nameWithOwner } }
  }
`;

const COMMENT = /* GraphQL */ `fragment Comment on IssueComment { __typename id author { login avatarUrl } bodyHTML createdAt }`;

// A parent, sub-issue or dependency. The id is what the relationship mutations take.
const RELATED = /* GraphQL */ `fragment Related on Issue { __typename id number title url state stateReason repository { nameWithOwner } }`;

// The first request: the issue, its sidebar and its newest comments, in a third of the full timeline's time.
// `issueOrPullRequest`: `/issues/<n>` of a pull request is a redirect on GitHub, so the page needs to know.
const ISSUE_QUERY = /* GraphQL */ `
  ${REF}
  ${COMMENT}
  ${RELATED}
  query Issue($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      isPrivate
      issueOrPullRequest(number: $number) {
        __typename
        ... on PullRequest { url }
        ... on Issue {
          id number title url state stateReason createdAt bodyHTML
          author { login avatarUrl }
          viewerCanClose viewerCanReopen viewerCanUpdateMetadata
          labels(first: 20) { nodes { name color } }
          assignees(first: 10) { nodes { login avatarUrl } }
          milestone { title url }
          closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { ...Ref ... on PullRequest { id } } }
          parent { ...Related }
          subIssuesSummary { total completed }
          subIssues(first: 50) { nodes { ...Related } }
          blockedBy(first: 20) { totalCount nodes { ...Related } }
          blocking(first: 20) { totalCount nodes { ...Related } }
          comments(last: 10) { nodes { ...Comment } }
        }
      }
    }
  }
`;

// The rest of the activity (events, cross-references, older comments). Its comments' bodies make it the slow one.
const TIMELINE_QUERY = /* GraphQL */ `
  ${REF}
  ${COMMENT}
  query IssueTimeline($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issueOrPullRequest(number: $number) {
        ... on Issue {
          timelineItems(
            last: 100
            itemTypes: [
              ISSUE_COMMENT, CLOSED_EVENT, REOPENED_EVENT, LABELED_EVENT, UNLABELED_EVENT, ASSIGNED_EVENT,
              UNASSIGNED_EVENT, CROSS_REFERENCED_EVENT, RENAMED_TITLE_EVENT, CONNECTED_EVENT, DISCONNECTED_EVENT,
              PARENT_ISSUE_ADDED_EVENT, PARENT_ISSUE_REMOVED_EVENT, SUB_ISSUE_ADDED_EVENT, SUB_ISSUE_REMOVED_EVENT,
              BLOCKED_BY_ADDED_EVENT, BLOCKED_BY_REMOVED_EVENT, BLOCKING_ADDED_EVENT, BLOCKING_REMOVED_EVENT
            ]
          ) {
            totalCount
            nodes {
              __typename
              ...Comment
              ... on ClosedEvent {
                id actor { login avatarUrl } createdAt stateReason
                closer { __typename ... on PullRequest { number url } ... on Commit { abbreviatedOid url } }
              }
              ... on ReopenedEvent { id actor { login avatarUrl } createdAt }
              ... on LabeledEvent { id actor { login avatarUrl } createdAt label { name color } }
              ... on UnlabeledEvent { id actor { login avatarUrl } createdAt label { name color } }
              ... on AssignedEvent { id actor { login avatarUrl } createdAt assignee { ... on Actor { login } } }
              ... on UnassignedEvent { id actor { login avatarUrl } createdAt assignee { ... on Actor { login } } }
              ... on CrossReferencedEvent { id actor { login avatarUrl } createdAt source { ...Ref } }
              ... on RenamedTitleEvent { id actor { login avatarUrl } createdAt previousTitle }
              ... on ConnectedEvent { id actor { login avatarUrl } createdAt source { ...Ref } subject { ...Ref } }
              ... on DisconnectedEvent { id actor { login avatarUrl } createdAt source { ...Ref } subject { ...Ref } }
              ... on ParentIssueAddedEvent { id actor { login avatarUrl } createdAt issue: parent { ...Ref } }
              ... on ParentIssueRemovedEvent { id actor { login avatarUrl } createdAt issue: parent { ...Ref } }
              ... on SubIssueAddedEvent { id actor { login avatarUrl } createdAt issue: subIssue { ...Ref } }
              ... on SubIssueRemovedEvent { id actor { login avatarUrl } createdAt issue: subIssue { ...Ref } }
              ... on BlockedByAddedEvent { id actor { login avatarUrl } createdAt issue: blockingIssue { ...Ref } }
              ... on BlockedByRemovedEvent { id actor { login avatarUrl } createdAt issue: blockingIssue { ...Ref } }
              ... on BlockingAddedEvent { id actor { login avatarUrl } createdAt issue: blockedIssue { ...Ref } }
              ... on BlockingRemovedEvent { id actor { login avatarUrl } createdAt issue: blockedIssue { ...Ref } }
            }
          }
        }
      }
    }
  }
`;

/** An issue or pull request that another one links to (cross-references, linked pull requests). */
export type Ref =
  | { __typename: 'Issue'; number: number; title: string; url: string; state: IssueState; stateReason: IssueStateReason | null; repository: { nameWithOwner: string } }
  | { __typename: 'PullRequest'; number: number; title: string; url: string; state: PrState; isDraft: boolean; repository: { nameWithOwner: string } };

type Event<T extends string, Extra = object> = { __typename: T; id: string; actor: Actor; createdAt: string } & Extra;

export type IssueTimelineItem =
  | { __typename: 'IssueComment'; id: string; author: Actor; bodyHTML: string; createdAt: string }
  | Event<
      'ClosedEvent',
      {
        stateReason: IssueStateReason | null;
        closer: { __typename: 'PullRequest'; number: number; url: string } | { __typename: 'Commit'; abbreviatedOid: string; url: string } | { __typename: 'ProjectV2' } | null;
      }
    >
  | Event<'ReopenedEvent'>
  | Event<'LabeledEvent' | 'UnlabeledEvent', { label: Label }>
  | Event<'AssignedEvent' | 'UnassignedEvent', { assignee: { login?: string } | null }>
  | Event<'CrossReferencedEvent', { source: Ref }>
  | Event<'RenamedTitleEvent', { previousTitle: string }>
  | Event<'ConnectedEvent' | 'DisconnectedEvent', { source: Ref; subject: Ref }>
  /** `issue` is the other issue of the relationship; null when the viewer can't see it. */
  | Event<RelationEvent, { issue: Ref | null }>;

/** The timeline events for parents, sub-issues and dependencies. */
export type RelationEvent =
  | 'ParentIssueAddedEvent' | 'ParentIssueRemovedEvent' | 'SubIssueAddedEvent' | 'SubIssueRemovedEvent'
  | 'BlockedByAddedEvent' | 'BlockedByRemovedEvent' | 'BlockingAddedEvent' | 'BlockingRemovedEvent';

export type IssueComment = Extract<IssueTimelineItem, { __typename: 'IssueComment' }>;

/** A pull request that closes the issue when it merges. */
export type LinkedPr = Extract<Ref, { __typename: 'PullRequest' }> & { id: string };

/** A parent, sub-issue or dependency of an issue. */
export type RelatedIssue = Extract<Ref, { __typename: 'Issue' }> & { id: string };

/** The newest timeline items, and how many there are in all. */
export type IssueTimelineItems = { totalCount: number; nodes: IssueTimelineItem[] };

export type Issue = {
  __typename: 'Issue';
  id: string;
  number: number;
  title: string;
  url: string;
  state: IssueState;
  stateReason: IssueStateReason | null;
  createdAt: string;
  bodyHTML: string;
  author: Actor;
  viewerCanClose: boolean;
  viewerCanReopen: boolean;
  /** Whether the viewer may change the parent, sub-issues and dependencies (triage access). */
  viewerCanUpdateMetadata: boolean;
  labels: { nodes: Label[] };
  assignees: { nodes: NonNullable<Actor>[] };
  milestone: { title: string; url: string } | null;
  closedByPullRequestsReferences: { nodes: LinkedPr[] };
  parent: RelatedIssue | null;
  subIssuesSummary: { total: number; completed: number };
  /** In the order the maintainers gave them. */
  subIssues: { nodes: RelatedIssue[] };
  blockedBy: { totalCount: number; nodes: RelatedIssue[] };
  blocking: { totalCount: number; nodes: RelatedIssue[] };
  /** The newest comments, shown until the timeline loads. */
  comments: { nodes: IssueComment[] };
};

type IssueData = { repository: { isPrivate: boolean; issueOrPullRequest: Issue | { __typename: 'PullRequest'; url: string } | null } | null };
type TimelineData = { repository: { issueOrPullRequest: { timelineItems?: IssueTimelineItems } | null } | null };

export type ClosedReason = 'COMPLETED' | 'NOT_PLANNED';

/** Closed as not planned or as a duplicate: shown grey rather than purple, like GitHub. */
export const notPlanned = (reason: IssueStateReason | null) => reason === 'NOT_PLANNED' || reason === 'DUPLICATE';

const CLOSE = `mutation CloseIssue($id: ID!, $reason: IssueClosedStateReason!) { closeIssue(input: { issueId: $id, stateReason: $reason }) { clientMutationId } }`;
const REOPEN = `mutation ReopenIssue($id: ID!) { reopenIssue(input: { issueId: $id }) { clientMutationId } }`;

/** `usePrMutation` input that closes an issue for `reason`, or reopens it without one. */
export const stateChange = (id: string, reason?: ClosedReason) =>
  reason
    ? { query: CLOSE, variables: { id, reason }, success: reason === 'COMPLETED' ? 'Closed as completed' : 'Closed as not planned' }
    : { query: REOPEN, variables: { id }, success: 'Issue reopened' };

/**
 * What both of an issue's queries start with: invalidating it refetches the issue and its timeline. The version
 * keeps results persisted by an older build (missing newer fields) from rendering; bump it when the issue gains fields.
 */
export const issueKey = (owner: string, repo: string, number: number) => ['issue', 2, owner.toLowerCase(), repo.toLowerCase(), number] as const;

/** The issue and its newest comments: what the page shows first. */
export const issueQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: [...issueKey(owner, repo, number), 'head'],
    queryFn: () => gql<IssueData>(ISSUE_QUERY, { owner, repo, number }, true),
    persister: persisted,
  });

/** The issue's timeline, fetched beside `issueQuery`. Null when the number is a pull request's. */
export const issueTimelineQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: [...issueKey(owner, repo, number), 'timeline'],
    queryFn: async () => (await gql<TimelineData>(TIMELINE_QUERY, { owner, repo, number }, true)).repository?.issueOrPullRequest?.timelineItems ?? null,
    persister: persisted,
  });

/**
 * The activity to show: the issue's newest comments until the timeline loads, then the timeline. Newer comments
 * than the timeline's last item (a stored timeline under a fresh issue) come after it. `hidden` counts the older
 * items that aren't shown; it's unknown until the timeline loads.
 */
export function mergeTimeline(newest: IssueComment[], timeline: IssueTimelineItems | null | undefined): { items: IssueTimelineItem[]; hidden?: number } {
  if (!timeline) return { items: newest };
  const last = timeline.nodes.at(-1)?.createdAt ?? '';
  const known = new Set(timeline.nodes.map((item) => item.id));
  const later = newest.filter((comment) => !known.has(comment.id) && comment.createdAt > last);
  return { items: [...timeline.nodes, ...later], hidden: timeline.totalCount - timeline.nodes.length };
}
