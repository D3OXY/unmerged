import { HugeiconsIcon } from '@hugeicons/react';
import { MilestoneIcon } from '@hugeicons/core-free-icons';
import { repoPath } from '@/pages/pr/query';
import { Card, Field, Person } from '@/pages/pr/PrSidebar';
import { Pill } from '@/ui/primitives';
import { RefLink } from './IssueTimeline';
import type { Issue } from './query';

/** Assignees, labels, milestone and the pull requests that will close the issue. */
export function IssueSidebar({ issue }: { issue: Issue }) {
  const { assignees, labels, milestone } = issue;
  const prs = issue.closedByPullRequestsReferences.nodes;
  return (
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
      {prs.length > 0 && (
        <Field label="Linked pull requests">
          {prs.map((pr) => (
            <RefLink key={pr.url} subject={pr} here={repoPath(issue)} className="h-7 rounded-md px-2 text-[12.5px] hover:bg-hover" />
          ))}
        </Field>
      )}
    </Card>
  );
}
