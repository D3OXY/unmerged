import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { repoPath } from '@/pages/pr/query';
import { Card, Field } from '@/pages/pr/PrSidebar';
import { MoreOnGitHub } from '@/pages/pr/Timeline';
import { usePrMutation } from '@/pages/pr/usePrMutation';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/primitives';
import { IssuePicker } from './IssuePicker';
import { RefLink } from './IssueTimeline';
import { relationChange, type Relation } from './relations';
import type { Issue, RelatedIssue } from './query';

type Props = { issue: Issue; queryKey: QueryKey };

/**
 * The issue's sub-issues under its description, with how many are closed. People with triage access add and
 * remove them in place. Hidden when there are none and the viewer can't add one.
 */
export function SubIssuesCard({ issue, queryKey }: Props) {
  const { total, completed } = issue.subIssuesSummary;
  const subs = issue.subIssues.nodes;
  const editable = issue.viewerCanUpdateMetadata;
  if (!total && !editable) return null;
  return (
    <Panel className="p-2">
      <div className="flex h-7 items-center gap-2 px-2 text-[12px] font-medium text-muted">
        Sub-issues
        {total > 0 && (
          <>
            <span className="font-normal text-subtle tabular-nums">
              {completed} of {total}
            </span>
            {/* Static: it changes only when the issue refetches. */}
            <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-hover">
              <span className="block h-full rounded-full bg-merged" style={{ width: `${(completed / total) * 100}%` }} />
            </span>
          </>
        )}
        <span className="flex-1" />
        {editable && <RelationPicker issue={issue} queryKey={queryKey} relation="sub" title="Add sub-issue" related={subs} />}
      </div>
      {total === 0 && <p className="px-2 pb-1 text-[12.5px] text-subtle">None</p>}
      <RelatedList issue={issue} queryKey={queryKey} relation="sub" related={subs} />
      {total > subs.length && <MoreOnGitHub count={total - subs.length} noun="sub-issues" className="px-2 py-1" />}
    </Panel>
  );
}

/**
 * The parent issue and the dependencies (blocked by, blocking) in the sidebar. Each field shows when it has
 * issues or the viewer may change it.
 */
export function RelationshipsCard({ issue, queryKey }: Props) {
  const { parent, blockedBy, blocking, viewerCanUpdateMetadata: editable } = issue;
  if (!parent && !blockedBy.totalCount && !blocking.totalCount && !editable) return null;
  const parents = parent ? [parent] : [];
  const fields: { relation: Relation; label: string; title: string; related: RelatedIssue[]; total: number }[] = [
    { relation: 'parent', label: 'Parent issue', title: parent ? 'Change parent issue' : 'Add parent issue', related: parents, total: parents.length },
    { relation: 'blockedBy', label: 'Blocked by', title: 'Add blocked by', related: blockedBy.nodes, total: blockedBy.totalCount },
    { relation: 'blocking', label: 'Blocking', title: 'Add blocking', related: blocking.nodes, total: blocking.totalCount },
  ];
  return (
    <Card title="Relationships">
      {fields.map(
        (field) =>
          (field.total > 0 || editable) && (
            <Field
              key={field.relation}
              label={field.label}
              action={editable && <RelationPicker issue={issue} queryKey={queryKey} relation={field.relation} title={field.title} related={field.related} />}
            >
              {field.total === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
              <RelatedList issue={issue} queryKey={queryKey} relation={field.relation} related={field.related} />
              {field.total > field.related.length && <MoreOnGitHub count={field.total - field.related.length} noun="issues" className="px-2 py-1" />}
            </Field>
          ),
      )}
    </Card>
  );
}

/** Searches the repo's issues and adds the pick as `relation`. The issue itself and the ones already related aren't offered. */
function RelationPicker({ issue, queryKey, relation, title, related }: Props & { relation: Relation; title: string; related: RelatedIssue[] }) {
  const { mutate } = usePrMutation(queryKey);
  return (
    <IssuePicker
      repo={repoPath(issue)}
      kind="issue"
      title={title}
      hide={[issue.id, ...related.map((r) => r.id)]}
      onPick={(picked) => mutate(relationChange(relation, issue.id, picked.id, true))}
    />
  );
}

function RelatedList({ issue, queryKey, relation, related }: Props & { relation: Relation; related: RelatedIssue[] }) {
  return related.map((other) => (
    <RelatedRow key={other.id} other={other} here={repoPath(issue)} queryKey={queryKey} remove={issue.viewerCanUpdateMetadata && relationChange(relation, issue.id, other.id, false)} />
  ));
}

/** A related issue, with a button that removes the relationship when the viewer may. */
function RelatedRow({ other, here, queryKey, remove }: { other: RelatedIssue; here: string; queryKey: QueryKey; remove: ReturnType<typeof relationChange> | false }) {
  const removal = usePrMutation(queryKey);
  return (
    <div className="group/related flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] hover:bg-hover">
      <RefLink subject={other} here={here} className="flex-1" />
      {remove && (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Remove #${other.number}`}
          title="Remove"
          loading={removal.isPending}
          icon={<HugeiconsIcon icon={Cancel01Icon} className="size-3" />}
          onClick={() => removal.mutate(remove)}
          className={cx('size-5 shrink-0 group-hover/related:opacity-100 focus-visible:opacity-100', !removal.isPending && 'opacity-0')}
        />
      )}
    </div>
  );
}
