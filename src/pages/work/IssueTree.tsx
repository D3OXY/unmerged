import type { ReactNode } from 'react';
import { IssueIcon } from '@/ui/status';
import type { WorkItem } from './queries';
import type { IssueTree } from './tree';

/**
 * A nested list's rows: `row` draws an issue at its depth; parents that aren't in the list and the rest of long
 * families get their own lines. `peek` is whether a parent's link opens beside the list, as the rows do. `inset`
 * is the rows' left padding in px, which each level adds to.
 */
export function IssueTreeRows({ tree, peek, inset, row }: { tree: IssueTree; peek: boolean; inset: number; row: (item: WorkItem, depth: number) => ReactNode }) {
  return tree.rows.map((line) => {
    if (line.kind === 'item') return row(line.item, line.depth);
    const style = { paddingLeft: indent(inset, line.depth) };
    if (line.kind === 'more') {
      return (
        <button
          key={`more:${line.parentId}`}
          type="button"
          onClick={() => tree.expand(line.parentId)}
          style={style}
          className="flex h-8 w-full cursor-pointer items-center border-b border-line pr-4 text-left text-[12px] text-subtle hover:bg-hover hover:text-fg"
        >
          Show {line.count} more sub-{line.count === 1 ? 'issue' : 'issues'}
        </button>
      );
    }
    const { parent } = line;
    return (
      <a
        key={parent.id}
        href={parent.url}
        data-peek={peek || undefined}
        data-repo-private={parent.repository.isPrivate !== false || undefined}
        title="Parent issue, not in this list"
        style={style}
        className="flex h-9 items-center gap-2 border-b border-line pr-4 text-[13px] text-muted transition-colors hover:bg-hover focus:bg-hover focus:outline-none"
      >
        <IssueIcon state={parent.state} stateReason={parent.stateReason} className="opacity-60" />
        <span className="shrink-0 text-[12px] text-subtle tabular-nums">#{parent.number}</span>
        <span data-private="titles" className="min-w-0 truncate">
          {parent.title}
        </span>
      </a>
    );
  });
}

/** The left padding of a row at `depth`, from the list's own `inset`. */
export const indent = (inset: number, depth: number) => inset + depth * 20;
