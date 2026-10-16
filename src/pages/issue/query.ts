import { queryOptions } from '@tanstack/react-query';
import { gql } from '@/github/client';
import type { Actor, IssueState, IssueStateReason, Label, PrState } from '@/github/types';
import { persisted } from '@/lib/persist';

// `issueOrPullRequest`: `/issues/<n>` of a pull request is a redirect on GitHub, so the page needs to know.
const ISSUE_QUERY = /* GraphQL */ `
  fragment Ref on ReferencedSubject {
    __typename
    ... on Issue { number title url state stateReason repository { nameWithOwner } }
    ... on PullRequest { number title url state isDraft repository { nameWithOwner } }
  }

  query Issue($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issueOrPullRequest(number: $number) {
        __typename
        ... on PullRequest { url }
        ... on Issue {
          id number title url state stateReason createdAt bodyHTML
          author { login avatarUrl }
          viewerCanClose viewerCanReopen
          labels(first: 20) { nodes { name color } }
          assignees(first: 10) { nodes { login avatarUrl } }
          milestone { title url }
          closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { ...Ref } }
          timelineItems(
            last: 100
            itemTypes: [
              ISSUE_COMMENT, CLOSED_EVENT, REOPENED_EVENT, LABELED_EVENT, UNLABELED_EVENT, ASSIGNED_EVENT,
              UNASSIGNED_EVENT, CROSS_REFERENCED_EVENT, RENAMED_TITLE_EVENT, CONNECTED_EVENT
            ]
          ) {
            totalCount
            nodes {
              __typename
              ... on IssueComment { id author { login avatarUrl } bodyHTML createdAt }
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
  | Event<'ConnectedEvent', { source: Ref; subject: Ref }>;

export type LinkedPr = Extract<Ref, { __typename: 'PullRequest' }>;

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
  labels: { nodes: Label[] };
  assignees: { nodes: NonNullable<Actor>[] };
  milestone: { title: string; url: string } | null;
  closedByPullRequestsReferences: { nodes: LinkedPr[] };
  timelineItems: { totalCount: number; nodes: IssueTimelineItem[] };
};

type IssueData = { repository: { issueOrPullRequest: Issue | { __typename: 'PullRequest'; url: string } | null } | null };

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

export const issueQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['issue', owner.toLowerCase(), repo.toLowerCase(), number],
    queryFn: () => gql<IssueData>(ISSUE_QUERY, { owner, repo, number }, true),
    persister: persisted,
  });
