import { Fragment, type ReactNode } from 'react';
import { IssueIcon } from '@/ui/status';
import { groupByParent, type IssueParent, type WorkItem } from './queries';

/**
 * The rows of `items` (`row` draws one). With `grouped` (the Group issues by parent setting) they come under a
 * header for each parent issue, then under "No parent issue". `peek` is whether a parent's link opens beside
 * the list, as the rows do.
 */
export function ParentGroups({ items, grouped, peek, row }: { items: WorkItem[]; grouped: boolean; peek: boolean; row: (item: WorkItem) => ReactNode }) {
  if (!grouped) return items.map(row);
  return groupByParent(items).map(({ parent, items }) => (
    <Fragment key={parent?.id ?? ''}>
      <GroupHeader parent={parent} count={items.length} peek={peek} />
      {items.map(row)}
    </Fragment>
  ));
}

function GroupHeader({ parent, count, peek }: { parent: IssueParent | null; count: number; peek: boolean }) {
  return (
    <div
      data-repo-private={(parent && parent.repository.isPrivate !== false) || undefined}
      className="flex h-8 items-center gap-2 border-b border-line bg-bg px-4 text-[12px] text-subtle"
    >
      {parent ? (
        <>
          <IssueIcon state={parent.state} stateReason={parent.stateReason} className="size-3.5" />
          <a href={parent.url} data-peek={peek || undefined} data-private="titles" className="min-w-0 truncate font-medium text-fg hover:underline">
            {parent.title}
          </a>
          <span className="shrink-0 tabular-nums">#{parent.number}</span>
        </>
      ) : (
        <span className="font-medium">No parent issue</span>
      )}
      <span className="shrink-0 rounded-full bg-hover px-1.5 tabular-nums">
        {count}
        <span className="sr-only">{count === 1 ? ' issue' : ' issues'}</span>
      </span>
    </div>
  );
}
