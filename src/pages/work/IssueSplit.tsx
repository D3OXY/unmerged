import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowExpand01Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { navigate, withPeek } from '@/lib/navigation';
import { peekAt, type Peek } from '@/lib/routes';
import { timeAgo } from '@/lib/time';
import { useMedia } from '@/lib/useMedia';
import { Button } from '@/ui/Button';
import { Avatar, Panel } from '@/ui/primitives';
import { IssueIcon, PrStateIcon } from '@/ui/status';
import { PeekContent, peekPage, usePrivatePeek } from './PeekPanel';
import { isPeek, type WorkItem } from './queries';

/**
 * Whether the window is wide enough (Tailwind's `xl`) for an issue list to keep the open issue beside it.
 * Narrower, an opened issue goes to the shell's side panel instead, as a pull request does.
 */
export const useIssueSplit = () => useMedia('(min-width: 80rem)');

/**
 * Issues as a compact list beside the one that's open: `peek`, or the first issue until one is picked. j/k
 * opens the issue it lands on. Rows always open beside the list, whatever the side panel setting says.
 */
export function IssueSplit({ items, peek, scoped, byCreated, footer }: { items: WorkItem[]; peek?: Peek; scoped: boolean; byCreated: boolean; footer: ReactNode }) {
  const split = useIssueSplit();
  const first = items[0];
  const open = peek ?? (split && first ? peekAt(new URL(first.url)) : undefined);
  return (
    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(340px,2fr)_minmax(0,3fr)]">
      <Panel className="animate-enter overflow-hidden">
        {items.map((item) => (
          <IssueRow key={item.id} item={item} scoped={scoped} byCreated={byCreated} selected={isPeek(item, open)} follow={split} />
        ))}
        {footer}
      </Panel>
      {split && open && <Reader peek={open} />}
    </div>
  );
}

/** One line per issue: state, the repo's owner (across repos), number, title, label dots and time. */
function IssueRow({ item, scoped, byCreated, selected, follow }: { item: WorkItem; scoped: boolean; byCreated: boolean; selected: boolean; follow: boolean }) {
  return (
    <a
      href={item.url}
      data-row
      data-peek
      data-repo-private={item.repository.isPrivate !== false || undefined}
      aria-current={selected || undefined}
      // Keyboard focus (j/k) opens the issue; a click does that itself.
      onFocus={follow ? (e) => e.currentTarget.matches(':focus-visible') && navigate(withPeek(location.href, new URL(item.url).pathname)) : undefined}
      className={cx(
        'relative flex h-9 items-center gap-2 border-b border-line px-3 text-[13px] transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none',
        selected && 'bg-hover before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent',
      )}
    >
      {item.__typename === 'PullRequest' ? <PrStateIcon state={item.state} isDraft={item.isDraft} /> : <IssueIcon state={item.state} stateReason={item.stateReason} />}
      {!scoped && (
        <span title={item.repository.nameWithOwner} className="flex shrink-0">
          <Avatar src={item.repository.owner.avatarUrl} size={14} square />
        </span>
      )}
      <span className="shrink-0 text-[12px] text-subtle tabular-nums">#{item.number}</span>
      <span data-private="titles" className="min-w-0 flex-1 truncate font-medium text-fg/95">
        {item.title}
      </span>
      {item.labels.nodes.length > 0 && (
        <span className="flex shrink-0 gap-0.5" title={item.labels.nodes.map((l) => l.name).join(', ')}>
          {item.labels.nodes.map((label) => (
            <span key={label.name} className="size-[7px] rounded-full" style={{ background: `#${label.color}` }} />
          ))}
        </span>
      )}
      <span className="w-16 shrink-0 text-right text-[12px] text-subtle">{timeAgo(byCreated ? item.createdAt : item.updatedAt)}</span>
    </a>
  );
}

/** The open issue, scrolling on its own beside the list, with a button to open it full screen. */
function Reader({ peek }: { peek: Peek }) {
  const page = peekPage(peek);
  const privateRepo = usePrivatePeek(peek);
  return (
    // Keyed by the page so each one starts at the top, like a navigation.
    <section
      key={page}
      data-repo-private={privateRepo || undefined}
      aria-label="Open issue"
      className="@container sticky top-[108px] max-h-[calc(100vh-124px)] min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-line bg-bg"
    >
      <div className="sticky top-0 z-30 flex h-12 items-center gap-1.5 border-b border-line bg-bg/85 px-4 text-[12.5px] text-subtle backdrop-blur-xl">
        <a href={`/${peek.owner}/${peek.repo}`} data-private="repos" className="truncate hover:text-fg">
          {peek.owner}/{peek.repo}
        </a>
        <span className="shrink-0">#{peek.number}</span>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto"
          title="Open full screen"
          aria-label="Open full screen"
          icon={<HugeiconsIcon icon={ArrowExpand01Icon} className="size-4" />}
          onClick={() => navigate(page)}
        />
      </div>
      <PeekContent peek={peek} />
    </section>
  );
}
