import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { MilestoneIcon } from '@hugeicons/core-free-icons';
import { repoPath } from '@/pages/pr/query';
import { Card, Field, Person } from '@/pages/pr/PrSidebar';
import { Pill } from '@/ui/primitives';
import { IssuePicker } from './IssuePicker';
import { RelationshipsCard } from './IssueRelations';
import { RefLink } from './IssueTimeline';
import { useLinkPullRequest } from './useLinkPullRequest';
import type { Issue } from './query';

/** Assignees, labels, milestone and the pull requests that will close the issue; then its relationships. */
export function IssueSidebar({ issue, queryKey }: { issue: Issue; queryKey: QueryKey }) {
  const { assignees, labels, milestone } = issue;
  const prs = issue.closedByPullRequestsReferences.nodes;
  return (
    <>
      <Card title="Details">
        <Field label="Assignees">
          {assignees.nodes.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
          {assignees.nodes.map((a) => (
            <Person key={a.login} name={a.login} avatarUrl={a.avatarUrl} />
          ))}
        </Field>
        {labels.nodes.length > 0 && (
          <Field label="Labels">
            <div className="flex flex-wrap gap-1.5 px-2 pt-0.5">
              {labels.nodes.map((l) => (
                <Pill key={l.name} color={l.color}>
                  {l.name}
                </Pill>
              ))}
            </div>
          </Field>
        )}
        {milestone && (
          <Field label="Milestone">
            <a href={milestone.url} className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] hover:bg-hover">
              <HugeiconsIcon icon={MilestoneIcon} className="size-3.5 shrink-0 text-subtle" />
              <span className="truncate">{milestone.title}</span>
            </a>
          </Field>
        )}
        <Field label="Linked pull requests" action={issue.state === 'OPEN' && <LinkPullRequest issue={issue} queryKey={queryKey} />}>
          {prs.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
          {prs.map((pr) => (
            <RefLink key={pr.url} subject={pr} here={repoPath(issue)} className="h-7 rounded-md px-2 text-[12.5px] hover:bg-hover" />
          ))}
        </Field>
      </Card>
      <RelationshipsCard issue={issue} queryKey={queryKey} />
    </>
  );
}

/** Links one of the repo's pull requests that the viewer can edit: it gets "Closes #<issue>" in its description. */
function LinkPullRequest({ issue, queryKey }: { issue: Issue; queryKey: QueryKey }) {
  const link = useLinkPullRequest(queryKey);
  return (
    <IssuePicker
      repo={repoPath(issue)}
      kind="pr"
      title="Link a pull request"
      hide={issue.closedByPullRequestsReferences.nodes.map((pr) => pr.id)}
      onPick={(pr) => link.mutate({ pr: pr.id, issue: issue.number })}
    />
  );
}
