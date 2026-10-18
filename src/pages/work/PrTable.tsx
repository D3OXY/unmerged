import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown02Icon, ArrowUp02Icon, Comment01Icon, FilterIcon } from '@hugeicons/core-free-icons';
import type { Peek } from '@/lib/routes';
import { cx } from '@/lib/cx';
import { timeAgo } from '@/lib/time';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Avatar, Panel, Pill } from '@/ui/primitives';
import { CheckIcon, IssueIcon, PrStateIcon } from '@/ui/status';
import type { RepoLabel } from '@/ui/WorkRow';
import { isPeek, qualifierOf, sortOf, SORTS, withQualifier, type PrItem, type Sort, type WorkItem } from './queries';

const REVIEWS: MenuOption<string>[] = [
  { value: '', label: 'Any' },
  { value: 'review:required', label: 'Review required' },
  { value: 'review:approved', label: 'Approved' },
  { value: 'review:changes_requested', label: 'Changes requested' },
  { value: 'review:none', label: 'Not reviewed' },
  { value: 'review-requested:@me', label: 'Requested from you' },
];

const CHECKS: MenuOption<string>[] = [
  { value: '', label: 'Any' },
  { value: 'status:success', label: 'Passing' },
  { value: 'status:failure', label: 'Failing' },
  { value: 'status:pending', label: 'Pending' },
];

// Column widths, shared by the header and the rows. Columns drop out as the list narrows (a side panel open
// beside it, a small window), so the title keeps its room.
const COL = {
  who: 'hidden w-[150px] shrink-0 @3xl:flex',
  review: 'flex w-[76px] shrink-0 @3xl:w-[124px]',
  ci: 'flex w-9 shrink-0',
  size: 'hidden w-14 shrink-0 @4xl:flex',
  comments: 'hidden w-10 shrink-0 @4xl:flex',
  time: 'flex w-[88px] shrink-0 justify-end',
};

/**
 * Pull requests as a table: state, title, repository (or author, inside a repo), review, CI, size, comments and
 * time. The headers carry the list's controls: Review and CI filter, Comments and the time column sort, each by
 * rewriting one qualifier of `q`. With `peek` (the side panel setting) rows open beside the list.
 */
export function PrTable({ items, q, onQuery, repoLabel, peek, open, footer }: {
  items: WorkItem[];
  q: string;
  onQuery: (q: string) => void;
  repoLabel: RepoLabel;
  peek: boolean;
  open?: Peek;
  footer: ReactNode;
}) {
  const sort = sortOf(q);
  const setSort = (next: Sort) => onQuery(withQualifier(q, 'sort', `sort:${next}`));
  const byCreated = sort.startsWith('created');
  return (
    <Panel className="mt-4 animate-enter overflow-hidden">
      <div className="flex h-9 items-center gap-3 border-b border-line px-4 text-[12px] font-medium text-subtle">
        <span className="w-4 shrink-0" />
        <span className="min-w-0 flex-1">Title</span>
        <span className={COL.who}>{repoLabel === 'none' ? 'Author' : 'Repository'}</span>
        <HeaderFilter className={COL.review} label="Review" value={qualifierOf(q, 'review')} options={REVIEWS} onChange={(token) => onQuery(withQualifier(q, 'review', token))} />
        <HeaderFilter className={COL.ci} label="CI" value={qualifierOf(q, 'ci')} options={CHECKS} onChange={(token) => onQuery(withQualifier(q, 'ci', token))} />
        <span className={COL.size}>Size</span>
        <span className={COL.comments}>
          <button
            type="button"
            title="Most commented first"
            onClick={() => setSort('comments-desc')}
            className={cx('flex cursor-pointer items-center gap-0.5 hover:text-fg', sort === 'comments-desc' && 'text-fg')}
          >
            <HugeiconsIcon icon={Comment01Icon} className="size-3.5" />
            {sort === 'comments-desc' && <HugeiconsIcon icon={ArrowDown02Icon} className="size-3" />}
          </button>
        </span>
        <span className={COL.time}>
          <Menu<Sort>
            value={sort}
            options={(Object.keys(SORTS) as Sort[]).map((value) => ({ value, label: SORTS[value] }))}
            onChange={setSort}
            trigger={(openMenu) => (
              <button type="button" onClick={openMenu} className="flex cursor-pointer items-center gap-0.5 text-fg hover:text-fg">
                {byCreated ? 'Created' : 'Updated'}
                {sort !== 'comments-desc' && <HugeiconsIcon icon={sort.endsWith('asc') ? ArrowUp02Icon : ArrowDown02Icon} className="size-3" />}
              </button>
            )}
          />
        </span>
      </div>
      {items.map((item) => (
        <PrRow key={item.id} item={item} repoLabel={repoLabel} byCreated={byCreated} peek={peek} selected={isPeek(item, open)} />
      ))}
      {footer}
    </Panel>
  );
}

/** A column header that filters by one qualifier, marked while it's in use. */
function HeaderFilter({ label, value, options, onChange, className }: { label: string; value: string; options: MenuOption<string>[]; onChange: (token: string) => void; className: string }) {
  return (
    <span className={className}>
      <Menu<string>
        value={value}
        options={options}
        onChange={onChange}
        align="left"
        trigger={(open) => (
          <button type="button" onClick={open} title={`Filter by ${label}`} className={cx('flex cursor-pointer items-center gap-1 hover:text-fg', value && 'text-fg')}>
            {label}
            <HugeiconsIcon icon={FilterIcon} className={cx('size-3', value ? 'text-accent' : 'text-subtle')} />
          </button>
        )}
      />
    </span>
  );
}

/** One row. Issues can turn up too (the search is editable); they leave the pull request columns empty. */
function PrRow({ item, repoLabel, byCreated, peek, selected }: { item: WorkItem; repoLabel: RepoLabel; byCreated: boolean; peek: boolean; selected: boolean }) {
  const pr = item.__typename === 'PullRequest' ? item : null;
  const comments = item.comments.totalCount;
  return (
    <a
      href={item.url}
      data-row
      data-peek={peek || undefined}
      data-repo-private={item.repository.isPrivate !== false || undefined}
      aria-current={selected || undefined}
      className={cx(
        'relative flex h-10 items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none',
        selected && 'bg-hover before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent',
      )}
    >
      {pr ? <PrStateIcon state={pr.state} isDraft={pr.isDraft} /> : item.__typename === 'Issue' && <IssueIcon state={item.state} stateReason={item.stateReason} />}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cx('shrink-0 text-[12px] text-subtle tabular-nums', repoLabel === 'none' ? 'w-10' : 'w-14')}>#{item.number}</span>
        <span data-private="titles" className={cx('min-w-0 truncate', pr?.isDraft ? 'text-muted' : 'font-medium text-fg/95')}>
          {item.title}
        </span>
        {/*
          Labels give way long before the title does. One that doesn't fit wraps out of sight rather than being cut:
          the empty first item (full height, so the first line is) gives even the first label a line to wrap from.
        */}
        <span className="-ml-1 hidden h-5 min-w-0 shrink-[1000] flex-wrap gap-1 overflow-hidden *:shrink-0 @4xl:flex">
          <span className="h-5" />
          {item.labels.nodes.slice(0, 2).map((label) => (
            <Pill key={label.name} color={label.color}>
              {label.name}
            </Pill>
          ))}
        </span>
      </span>
      <span className={cx(COL.who, 'items-center gap-1.5 text-[12px] text-subtle')}>
        {repoLabel === 'none' ? (
          <>
            <Avatar src={item.author?.avatarUrl} size={16} />
            <span className="truncate">{item.author?.login ?? 'ghost'}</span>
          </>
        ) : (
          <span data-private="repos" className="truncate">{repoLabel === 'full' ? item.repository.nameWithOwner : item.repository.nameWithOwner.split('/')[1]}</span>
        )}
      </span>
      <span className={cx(COL.review, 'items-center gap-2')}>{pr && <Review pr={pr} />}</span>
      <span className={COL.ci}>
        <CheckIcon state={pr?.commits.nodes[0]?.commit.statusCheckRollup?.state} />
      </span>
      <span className={COL.size}>{pr && <Size pr={pr} />}</span>
      <span className={cx(COL.comments, 'items-center gap-1 text-[12px] text-subtle tabular-nums')}>
        {comments > 0 && (
          <>
            <HugeiconsIcon icon={Comment01Icon} className="size-3" />
            {comments}
          </>
        )}
      </span>
      <span className={cx(COL.time, 'text-[12px] text-subtle')}>{timeAgo(byCreated ? item.createdAt : item.updatedAt)}</span>
    </a>
  );
}

const DECISIONS = {
  APPROVED: ['Approved', 'text-success'],
  CHANGES_REQUESTED: ['Changes', 'text-danger'],
  REVIEW_REQUIRED: ['Review', 'text-muted'],
} as const;

/** The review decision, and the faces behind it: who reviewed, then who's still asked. */
function Review({ pr }: { pr: PrItem }) {
  const decision = pr.reviewDecision && DECISIONS[pr.reviewDecision];
  const people = [
    ...pr.latestOpinionatedReviews.nodes.flatMap(({ author }) => (author ? [{ name: author.login, avatarUrl: author.avatarUrl }] : [])),
    ...pr.reviewRequests.nodes.flatMap(({ requestedReviewer: r }) => (r?.avatarUrl ? [{ name: r.login ?? r.name ?? '', avatarUrl: r.avatarUrl }] : [])),
  ].slice(0, 3);
  return (
    <>
      {decision && <span className={cx('text-[12px] font-medium', decision[1])}>{decision[0]}</span>}
      {people.length > 0 && (
        <span className="hidden -space-x-1 @3xl:flex" title={people.map((p) => p.name).join(', ')}>
          {people.map((p) => (
            <Avatar key={p.name} src={p.avatarUrl} size={16} />
          ))}
        </span>
      )}
    </>
  );
}

// Lines changed (added + removed) below which a pull request gets each size.
const SIZES = [
  [50, 'XS'],
  [150, 'S'],
  [400, 'M'],
  [Infinity, 'L'],
] as const;

/** Lines changed as a four-step bar; the exact counts are in its tooltip. */
function Size({ pr }: { pr: PrItem }) {
  const step = SIZES.findIndex(([max]) => pr.additions + pr.deletions < max);
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-subtle" title={`+${pr.additions} −${pr.deletions}`}>
      <span className="flex gap-0.5">
        {SIZES.map(([, name], i) => (
          <span key={name} className={cx('h-2.5 w-1 rounded-[1px]', i <= step ? 'bg-muted' : 'bg-line-strong')} />
        ))}
      </span>
      {SIZES[step]![1]}
    </span>
  );
}
