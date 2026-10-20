import { gql } from '@/github/client';

/** How another issue relates to this one, as the sidebar and the sub-issues card list them. */
export type Relation = 'parent' | 'sub' | 'blockedBy' | 'blocking';

const ADD_SUB = `mutation AddSubIssue($id: ID!, $sub: ID!, $replace: Boolean) { addSubIssue(input: { issueId: $id, subIssueId: $sub, replaceParent: $replace }) { clientMutationId } }`;
const REMOVE_SUB = `mutation RemoveSubIssue($id: ID!, $sub: ID!) { removeSubIssue(input: { issueId: $id, subIssueId: $sub }) { clientMutationId } }`;
const ADD_BLOCKED_BY = `mutation AddBlockedBy($id: ID!, $blocker: ID!) { addBlockedBy(input: { issueId: $id, blockingIssueId: $blocker }) { clientMutationId } }`;
const REMOVE_BLOCKED_BY = `mutation RemoveBlockedBy($id: ID!, $blocker: ID!) { removeBlockedBy(input: { issueId: $id, blockingIssueId: $blocker }) { clientMutationId } }`;

/**
 * `usePrMutation` input that adds (or removes) `other` as the issue's `relation`. GitHub stores each one from
 * one side: a parent is the other issue's sub-issue, and blocking is the other issue's blocked by. A new parent
 * replaces the old one.
 */
export function relationChange(relation: Relation, issue: string, other: string, add: boolean) {
  switch (relation) {
    case 'parent':
      return add
        ? { query: ADD_SUB, variables: { id: other, sub: issue, replace: true }, success: 'Parent issue set' }
        : { query: REMOVE_SUB, variables: { id: other, sub: issue }, success: 'Parent issue removed' };
    case 'sub':
      return add
        ? { query: ADD_SUB, variables: { id: issue, sub: other }, success: 'Sub-issue added' }
        : { query: REMOVE_SUB, variables: { id: issue, sub: other }, success: 'Sub-issue removed' };
    case 'blockedBy':
      return { query: add ? ADD_BLOCKED_BY : REMOVE_BLOCKED_BY, variables: { id: issue, blocker: other }, success: add ? 'Marked as blocked' : 'No longer blocked by it' };
    case 'blocking':
      return { query: add ? ADD_BLOCKED_BY : REMOVE_BLOCKED_BY, variables: { id: other, blocker: issue }, success: add ? 'Marked as blocking' : 'No longer blocking it' };
  }
}

/**
 * `body` with a line that closes issue `number` of the same repo when the pull request merges. GitHub's API has no
 * other way to link a pull request to an issue; GitHub reads the keyword and lists the link on both sides.
 */
export const withClosingReference = (body: string, number: number) => `${body.trimEnd()}${body.trim() ? '\n\n' : ''}Closes #${number}`;

const PR_BODY_QUERY = `query PrBody($id: ID!) { node(id: $id) { ... on PullRequest { body } } }`;
const UPDATE_BODY = `mutation UpdatePullRequest($id: ID!, $body: String!) { updatePullRequest(input: { pullRequestId: $id, body: $body }) { clientMutationId } }`;

/** Links the pull request `pr` (a node id) to issue `number` of its repo: a closing keyword in its current description. */
export async function linkPullRequest(pr: string, number: number) {
  const { node } = await gql<{ node: { body: string } | null }>(PR_BODY_QUERY, { id: pr });
  if (!node) throw new Error('Pull request not found.');
  await gql(UPDATE_BODY, { id: pr, body: withClosingReference(node.body, number) });
}

/** Issues or pull requests for a picker. */
export type CandidateKind = 'issue' | 'pr';

/**
 * What the picker asks GitHub for in `repo`: a search for `text` (recently updated open ones when it's empty),
 * and the exact number when `text` is one (`12` or `#12`), which the search doesn't match.
 */
export function candidateSearch(kind: CandidateKind, repo: string, text: string) {
  const trimmed = text.trim();
  const number = /^#?(\d+)$/.exec(trimmed)?.[1];
  return {
    q: `repo:${repo} is:${kind} ${trimmed ? trimmed.replace(/^#(?=\d+$)/, '') : 'is:open'} sort:updated-desc`,
    number: number ? Number(number) : undefined,
  };
}
