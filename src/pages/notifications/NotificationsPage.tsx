import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CircleDotIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  InboxIcon,
  MessageMultiple02Icon,
  Notification03Icon,
  NotificationOff03Icon,
  Tag01Icon,
  Tick02Icon,
  TickDouble02Icon,
} from '@hugeicons/core-free-icons';
import { rest } from '@/github/client';
import { usePageHotkey } from '@/app/keyboard';
import { prefetchVisibleRows } from '@/app/prefetch';
import { PageHeader, Shell } from '@/app/Shell';
import { cx } from '@/lib/cx';
import { onNavigate } from '@/lib/navigation';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { IssueIcon, PrStateIcon } from '@/ui/status';
import { Tab, TabBar } from '@/ui/Tabs';
import { toast } from '@/ui/toast';
import {
  filtersOf,
  notificationsQuery,
  notificationsUrl,
  subjectRef,
  subjectStatesQuery,
  unreadPollQuery,
  type Filters,
  type Notification,
  type SubjectState,
  type View,
} from './queries';

const VIEWS: Record<View, { label: string; icon: ReactNode }> = {
  inbox: { label: 'Inbox', icon: <HugeiconsIcon icon={InboxIcon} /> },
  unread: { label: 'Unread', icon: <HugeiconsIcon icon={Notification03Icon} /> },
  participating: { label: 'Participating', icon: <HugeiconsIcon icon={MessageMultiple02Icon} /> },
};

const REASONS: Record<string, string> = {
  approval_requested: 'Approval requested',
  assign: 'Assigned',
  author: 'Author',
  ci_activity: 'CI activity',
  comment: 'Comment',
  invitation: 'Invitation',
  manual: 'Subscribed',
  member_feature_requested: 'Feature request',
  mention: 'Mention',
  review_requested: 'Review requested',
  security_alert: 'Security alert',
  state_change: 'State change',
  subscribed: 'Watching',
  team_mention: 'Team mention',
};
const reasonLabel = (reason: string) => REASONS[reason] ?? reason.replace(/_/g, ' ');

// Reasons that ask something of you get the accent.
const LOUD = new Set(['review_requested', 'mention', 'assign', 'approval_requested', 'security_alert', 'team_mention']);

const ICONS: Record<string, ReactNode> = {
  PullRequest: <HugeiconsIcon icon={GitPullRequestIcon} />,
  Issue: <HugeiconsIcon icon={CircleDotIcon} />,
  Commit: <HugeiconsIcon icon={GitCommitHorizontalIcon} />,
  Release: <HugeiconsIcon icon={Tag01Icon} />,
  Discussion: <HugeiconsIcon icon={MessageMultiple02Icon} />,
  CheckSuite: <HugeiconsIcon icon={CheckmarkCircle02Icon} />,
};

const API_PATH: Record<string, string> = { pulls: 'pull', issues: 'issues', commits: 'commit' };
const REPO_PAGE: Record<string, string> = { Release: '/releases', Discussion: '/discussions', CheckSuite: '/actions' };

/** The github.com page a notification is about. The API only gives API URLs, and none for some types. */
function pageUrl({ subject, repository }: Notification) {
  const match = subject.url?.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/(pulls|issues|commits)\/(.+)$/);
  const kind = match?.[2] && API_PATH[match[2]];
  if (match && kind) return `https://github.com/${match[1]}/${kind}/${match[3]}`;
  return `${repository.html_url}${REPO_PAGE[subject.type] ?? ''}`;
}

const dayFormat = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' });
function dayLabel(iso: string) {
  const days = Math.floor((new Date().setHours(24, 0, 0, 0) - new Date(iso).getTime()) / 86_400_000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? 'This week' : dayFormat.format(new Date(iso));
}

/** The notification row that has keyboard focus (j/k), if any. */
function focusedRow(list: HTMLElement | null) {
  const root = list?.getRootNode();
  return root instanceof ShadowRoot ? root.activeElement?.closest<HTMLElement>('[data-notification]') : null;
}

/**
 * Your GitHub notifications: inbox, unread or participating, grouped by day, filterable by repository and
 * reason (kept in the URL). `x` selects rows; `e` (done) and `⇧I` (read) act on the selection, or the focused row.
 */
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(() => filtersOf(new URL(location.href)));
  const { view, repo, reason } = filters;
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const options = notificationsQuery(view);
  const { queryKey } = options;

  useTitle('Notifications');

  // Tabs and filters are links (`?query=is:unread repo:…`); the route stays the same, so follow the URL here.
  useEffect(
    () =>
      onNavigate((url) => {
        setFilters(filtersOf(url));
        setSelection(new Set());
      }),
    [],
  );

  const list = useInfiniteQuery(options);

  // The list doesn't poll; when the cheap unread poll sees a change, refetch it (only then).
  const lastModified = useQuery(unreadPollQuery).data?.lastModified;
  const seen = useRef(lastModified);
  useEffect(() => {
    if (lastModified === seen.current) return;
    if (seen.current !== undefined) queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    seen.current = lastModified;
  }, [lastModified, queryClient]);

  // Pages can overlap when threads move between fetches; show each thread once.
  const all = useMemo(() => [...new Map(list.data?.pages.flatMap((page) => page.items).map((n) => [n.id, n])).values()], [list.data]);
  const inRepo = (n: Notification) => n.repository.full_name.toLowerCase() === repo?.toLowerCase();
  const shown = all.filter((n) => (!repo || inRepo(n)) && (!reason || n.reason === reason));
  const shownUnread = shown.filter((n) => n.unread).map((n) => n.id);
  const selected = shown.filter((n) => selection.has(n.id)).map((n) => n.id);

  // Unread counts per repository and per reason, for the filters.
  const groups = useMemo(() => {
    const repos = new Map<string, { avatar: string; isPrivate: boolean; total: number; unread: number }>();
    const reasons = new Map<string, number>();
    for (const n of all) {
      const entry = repos.get(n.repository.full_name) ?? { avatar: n.repository.owner.avatar_url, isPrivate: n.repository.private, total: 0, unread: 0 };
      entry.total++;
      if (n.unread) entry.unread++;
      repos.set(n.repository.full_name, entry);
      reasons.set(n.reason, (reasons.get(n.reason) ?? 0) + (n.unread ? 1 : 0));
    }
    return {
      repos: [...repos].sort(([, a], [, b]) => b.unread - a.unread || b.total - a.total),
      reasons: [...reasons].sort(([, a], [, b]) => b - a),
    };
  }, [all]);

  // The rows on screen get their pages' first paint ready; again whenever the rows change.
  useEffect(() => (listRef.current ? prefetchVisibleRows(queryClient, listRef.current) : undefined), [queryClient, list.data, repo, reason]);

  const refs = useMemo(() => [...new Set(all.map(subjectRef).filter((ref) => ref !== null))].sort(), [all]);
  const states = useQuery(subjectStatesQuery(refs)).data;

  /** Marks matching threads read (or, with `remove`, drops them) in this list and the unread badge, ahead of GitHub. */
  const patch = async (match: (n: Notification) => boolean, remove: boolean) => {
    // A refetch already under way would land after this change and undo it.
    await Promise.all([queryClient.cancelQueries({ queryKey }), queryClient.cancelQueries({ queryKey: unreadPollQuery.queryKey })]);
    const drop = remove || view === 'unread';
    queryClient.setQueryData(queryKey, (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({ ...page, items: drop ? page.items.filter((n) => !match(n)) : page.items.map((n) => (match(n) ? { ...n, unread: false } : n)) })),
      },
    );
    queryClient.setQueryData(unreadPollQuery.queryKey, (poll) => poll && { ...poll, unread: poll.unread.filter((n) => !match(n)) });
  };
  const byId = (ids: string[]) => (n: Notification) => ids.includes(n.id);
  const onError = (error: Error) => {
    toast.error(error);
    queryClient.invalidateQueries({ queryKey });
    // Unconditionally: a 304 would keep the optimistic count.
    queryClient.resetQueries({ queryKey: unreadPollQuery.queryKey });
  };

  const markRead = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => rest(`/notifications/threads/${id}`, { method: 'PATCH' }))),
    onMutate: (ids) => patch(byId(ids), false),
    onError,
  });
  const markDone = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => rest(`/notifications/threads/${id}`, { method: 'DELETE' }))),
    onMutate: (ids) => patch(byId(ids), true),
    onError,
  });
  // As on GitHub: no more notifications for the thread, and it leaves the inbox.
  const unsubscribe = useMutation({
    mutationFn: (id: string) => Promise.all([rest(`/notifications/threads/${id}/subscription`, { method: 'DELETE' }), rest(`/notifications/threads/${id}`, { method: 'DELETE' })]),
    onMutate: (id) => patch(byId([id]), true),
    onError,
  });
  // Scoped to the repository filter when there is one.
  const markAllRead = useMutation({
    mutationFn: () => rest(repo ? `/repos/${repo}/notifications` : '/notifications', { method: 'PUT', body: { last_read_at: new Date().toISOString(), read: true } }),
    onMutate: () => patch(repo ? inRepo : () => true, false),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }),
    onError,
  });

  /** A key's action: on the selection if there is one, else the focused row. `leaving`: the row goes away, so focus moves on. */
  const onKey = (act: (ids: string[]) => void, leaving: boolean) => () => {
    if (selected.length) {
      act(selected);
      setSelection(new Set());
      return;
    }
    const row = focusedRow(listRef.current);
    const id = row?.dataset.notification;
    if (!row || !id) return;
    if (leaving) {
      const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-notification]') ?? [])];
      rows[rows.indexOf(row) + 1]?.focus();
    }
    act([id]);
  };
  usePageHotkey('e', onKey(markDone.mutate, true), 'Done with the selected or focused notifications');
  usePageHotkey('I', onKey(markRead.mutate, view === 'unread'), 'Mark the selected or focused notifications read');
  usePageHotkey('x', () => {
    const id = focusedRow(listRef.current)?.dataset.notification;
    if (!id) return;
    setSelection((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, 'Select the focused notification');

  const link = (change: Partial<Filters>) => notificationsUrl({ ...filters, ...change });
  let lastDay = '';

  return (
    <Shell active="notifications">
      <PageHeader
        crumbs={[{ label: 'Notifications' }]}
        actions={
          selected.length > 0 ? (
            <>
              <span className="mr-1 text-[12px] text-subtle tabular-nums">{selected.length} selected</span>
              <Button size="sm" icon={<HugeiconsIcon icon={Tick02Icon} className="size-3.5" />} onClick={onKey(markRead.mutate, false)}>
                Mark as read
              </Button>
              <Button size="sm" icon={<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />} onClick={onKey(markDone.mutate, false)}>
                Done
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection(new Set())}>
                Clear
              </Button>
            </>
          ) : (
            shownUnread.length > 0 && (
              // GitHub can mark a whole repository read, but not a reason; then it's the loaded threads shown.
              <Button
                size="sm"
                icon={<HugeiconsIcon icon={TickDouble02Icon} className="size-3.5" />}
                loading={markAllRead.isPending}
                onClick={() => (reason ? markRead.mutate(shownUnread) : markAllRead.mutate())}
              >
                {reason ? `Mark ${shownUnread.length} as read` : repo ? `Mark all in ${repo.split('/')[1]} as read` : 'Mark all as read'}
              </Button>
            )
          )
        }
      />
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <TabBar
          className="mt-2"
          trailing={
            <span className="hidden items-center gap-1.5 text-[12px] text-subtle md:flex">
              <Kbd>X</Kbd> select · <Kbd>E</Kbd> done · <Kbd>⇧I</Kbd> read · <Kbd>J</Kbd>
              <Kbd>K</Kbd> move
            </span>
          }
        >
          {(Object.keys(VIEWS) as View[]).map((key) => (
            <Tab key={key} href={link({ view: key })} active={view === key} icon={VIEWS[key].icon} label={VIEWS[key].label} />
          ))}
        </TabBar>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="px-2 pb-1.5 text-[11px] font-medium text-subtle">Repositories</div>
            <FilterLink
              href={link({ repo: null })}
              active={repo === null}
              label="All repositories"
              icon={<HugeiconsIcon icon={InboxIcon} className="size-3.5 shrink-0" />}
              count={all.filter((n) => n.unread).length}
            />
            {groups.repos.map(([name, { avatar, isPrivate, unread }]) => (
              <FilterLink
                key={name}
                href={link({ repo: name })}
                active={name.toLowerCase() === repo?.toLowerCase()}
                label={name}
                icon={<Avatar src={avatar} size={14} square />}
                count={unread}
                isPrivate={isPrivate}
              />
            ))}
            {groups.reasons.length > 0 && <div className="mt-5 px-2 pb-1.5 text-[11px] font-medium text-subtle">Reasons</div>}
            {groups.reasons.map(([key, unread]) => (
              <FilterLink key={key} href={link({ reason: key === reason ? null : key })} active={key === reason} label={reasonLabel(key)} count={unread} />
            ))}
          </aside>

          <div ref={listRef} className="min-w-0">
            {list.error ? (
              <p className="py-10 text-[13px] text-danger">{list.error.message}</p>
            ) : list.isPending ? (
              <Panel className="flex flex-col gap-3 p-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-4" />
                ))}
              </Panel>
            ) : shown.length === 0 && !list.hasNextPage ? (
              <Panel>
                <Empty>{view === 'unread' ? 'All caught up.' : 'No notifications.'}</Empty>
              </Panel>
            ) : (
              <Panel className="animate-enter overflow-hidden">
                {shown.map((n) => {
                  const day = dayLabel(n.updated_at);
                  const header = day !== lastDay ? day : null;
                  lastDay = day;
                  const ref = subjectRef(n);
                  return (
                    <div key={n.id}>
                      {header && <div className="border-b border-line bg-bg/40 px-4 py-1.5 text-[11.5px] font-medium text-subtle">{header}</div>}
                      <NotificationRow
                        notification={n}
                        state={ref ? states?.[ref] : undefined}
                        selected={selection.has(n.id)}
                        onOpen={() => n.unread && markRead.mutate([n.id])}
                        onRead={() => markRead.mutate([n.id])}
                        onDone={() => markDone.mutate([n.id])}
                        onUnsubscribe={() => unsubscribe.mutate(n.id)}
                      />
                    </div>
                  );
                })}
                {list.hasNextPage && (
                  <div className={cx('flex justify-center p-3', shown.length > 0 && 'border-t border-line')}>
                    <Button size="sm" variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                      Load more
                    </Button>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/**
 * A real link (⌘/middle-click, hover prefetch), with the row's actions beside it rather than inside it.
 * Opening marks it read. Plain clicks are taken over by the content script's capture-phase link handler before
 * React sees a `click`, so this listens for the pointer release (left or middle button) and Enter instead.
 */
function NotificationRow({
  notification: n,
  state,
  selected,
  onOpen,
  onRead,
  onDone,
  onUnsubscribe,
}: {
  notification: Notification;
  state: SubjectState | undefined;
  selected: boolean;
  onOpen: () => void;
  onRead: () => void;
  onDone: () => void;
  onUnsubscribe: () => void;
}) {
  const [owner, name] = n.repository.full_name.split('/');
  return (
    <div
      className={cx(
        'group flex h-12 items-center border-b border-line transition-colors last:border-b-0 focus-within:bg-hover hover:bg-hover',
        selected && 'bg-accent/10 shadow-[inset_2px_0_0_var(--color-accent)]',
      )}
    >
      <a
        href={pageUrl(n)}
        data-row
        data-notification={n.id}
        data-repo-private={n.repository.private || undefined}
        onPointerUp={(e) => e.button <= 1 && onOpen()}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
        className="flex h-full min-w-0 flex-1 items-center gap-3 px-4 focus:outline-none"
      >
        <span className={cx('size-1.5 shrink-0 rounded-full', n.unread ? 'bg-accent' : 'bg-transparent')} />
        <span className={cx('flex size-4 shrink-0 items-center [&>svg]:size-4', n.unread ? 'text-fg' : 'text-subtle')}>
          {state?.__typename === 'PullRequest' ? (
            <PrStateIcon state={state.state} isDraft={state.isDraft} />
          ) : state?.__typename === 'Issue' ? (
            <IssueIcon state={state.state} stateReason={state.stateReason} />
          ) : (
            (ICONS[n.subject.type] ?? <HugeiconsIcon icon={Notification03Icon} />)
          )}
        </span>
        <span className="flex w-[180px] shrink-0 items-center gap-1.5 truncate text-[12px] text-subtle">
          <Avatar src={n.repository.owner.avatar_url} size={14} square />
          <span data-private="repos" className="truncate">
            {owner}/<span className="text-muted">{name}</span>
          </span>
        </span>
        <span data-private="titles" className={cx('min-w-0 flex-1 truncate text-[13px]', n.unread ? 'font-medium text-fg' : 'text-muted')}>
          {n.subject.title}
        </span>
        <span
          className={cx(
            'hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] md:inline',
            LOUD.has(n.reason) ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line text-subtle',
          )}
        >
          {reasonLabel(n.reason)}
        </span>
        <span className="w-16 shrink-0 text-right text-[12px] text-subtle group-focus-within:hidden group-hover:hidden">{timeAgo(n.updated_at)}</span>
      </a>
      <span className="hidden shrink-0 gap-0.5 pr-3 group-focus-within:flex group-hover:flex">
        {n.unread && <RowAction label="Mark as read (⇧I)" icon={<HugeiconsIcon icon={Tick02Icon} />} onClick={onRead} />}
        <RowAction label="Unsubscribe" icon={<HugeiconsIcon icon={NotificationOff03Icon} />} onClick={onUnsubscribe} />
        <RowAction label="Done (E)" icon={<HugeiconsIcon icon={Cancel01Icon} />} onClick={onDone} />
      </span>
    </div>
  );
}

function RowAction({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-elevated hover:text-fg [&>svg]:size-3.5"
    >
      {icon}
    </button>
  );
}

/** `isPrivate`: the label names a private repository, which Privacy may blur. */
function FilterLink({ href, active, label, icon, count, isPrivate }: { href: string; active: boolean; label: string; icon?: ReactNode; count: number; isPrivate?: boolean }) {
  return (
    <a
      href={href}
      title={label}
      data-repo-private={isPrivate || undefined}
      className={cx(
        'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px]',
        active ? 'bg-hover font-medium text-fg' : 'text-muted hover:bg-hover hover:text-fg',
      )}
    >
      {icon}
      <span data-private={isPrivate ? 'repos' : undefined} className="min-w-0 flex-1 truncate">
        {label}
      </span>
      {count > 0 && <span className="text-[11px] text-subtle tabular-nums">{count}</span>}
    </a>
  );
}
