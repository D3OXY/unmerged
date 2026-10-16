import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CheckmarkCircle02Icon, CircleDotIcon, GitCommitHorizontalIcon, GitPullRequestIcon, InboxIcon, MessageMultiple02Icon, Notification03Icon, Tag01Icon, Tick02Icon, TickDouble02Icon } from '@hugeicons/core-free-icons';
import { rest } from '@/github/client';
import { usePageHotkey } from '@/app/keyboard';
import { PageHeader, Shell } from '@/app/Shell';
import { cx } from '@/lib/cx';
import { navigate, onNavigate } from '@/lib/navigation';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { Tab, TabBar } from '@/ui/Tabs';
import { toast } from '@/ui/toast';
import { notificationsQuery, viewOf, type Notification, type View } from './queries';

// GitHub's own `?query=` values for these views, so links in and out keep meaning the same thing.
const VIEWS: Record<View, { label: string; query: string | null; icon: ReactNode }> = {
  inbox: { label: 'Inbox', query: null, icon: <HugeiconsIcon icon={InboxIcon} /> },
  unread: { label: 'Unread', query: 'is:unread', icon: <HugeiconsIcon icon={Notification03Icon} /> },
  participating: { label: 'Participating', query: 'reason:participating', icon: <HugeiconsIcon icon={MessageMultiple02Icon} /> },
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

/** Your GitHub notifications: inbox, unread or participating, grouped by day, filterable by repository. */
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState(() => viewOf(new URL(location.href)));
  const [repo, setRepo] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const options = notificationsQuery(view);
  const { queryKey } = options;

  useTitle('Notifications');

  // Tabs are links (`?query=is:unread`); the route stays the same, so follow the URL here.
  useEffect(
    () =>
      onNavigate(() => {
        setView(viewOf(new URL(location.href)));
        setRepo(null);
      }),
    [],
  );

  const list = useInfiniteQuery(options);

  const all = useMemo(() => list.data?.pages.flat() ?? [], [list.data]);
  const shown = repo ? all.filter((n) => n.repository.full_name === repo) : all;

  const repos = useMemo(() => {
    const counts = new Map<string, { avatar: string; total: number; unread: number }>();
    for (const n of all) {
      const entry = counts.get(n.repository.full_name) ?? { avatar: n.repository.owner.avatar_url, total: 0, unread: 0 };
      entry.total++;
      if (n.unread) entry.unread++;
      counts.set(n.repository.full_name, entry);
    }
    return [...counts].sort(([, a], [, b]) => b.unread - a.unread || b.total - a.total);
  }, [all]);

  /** Applies a change to every loaded page of this view's cache. */
  const patch = (change: (items: Notification[]) => Notification[]) =>
    queryClient.setQueryData(queryKey, (data) => data && { ...data, pages: data.pages.map(change) });

  const markRead = useMutation({
    mutationFn: (id: string) => rest(`/notifications/threads/${id}`, { method: 'PATCH' }),
    onMutate: (id) => patch((items) => (view === 'unread' ? items.filter((n) => n.id !== id) : items.map((n) => (n.id === id ? { ...n, unread: false } : n)))),
    onError: (error) => {
      toast.error(error);
      return list.refetch();
    },
  });
  const markDone = useMutation({
    mutationFn: (id: string) => rest(`/notifications/threads/${id}`, { method: 'DELETE' }),
    onMutate: (id) => patch((items) => items.filter((n) => n.id !== id)),
    onError: (error) => {
      toast.error(error);
      return list.refetch();
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => rest('/notifications', { method: 'PUT', body: { last_read_at: new Date().toISOString(), read: true } }),
    onMutate: () => patch((items) => (view === 'unread' ? [] : items.map((n) => ({ ...n, unread: false })))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: toast.error,
  });

  // `e`: done with the focused notification, then focus moves to the next one.
  usePageHotkey(
    'e',
    useCallback(() => {
      const root = listRef.current?.getRootNode();
      const row = root instanceof ShadowRoot ? root.activeElement?.closest<HTMLElement>('[data-notification]') : null;
      const id = row?.dataset.notification;
      if (!row || !id) return;
      const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-notification]') ?? [])];
      rows[rows.indexOf(row) + 1]?.focus();
      markDone.mutate(id);
    }, [markDone]),
  );

  const open = (n: Notification) => {
    if (n.unread) markRead.mutate(n.id);
    navigate(pageUrl(n));
  };

  const unreadCount = all.filter((n) => n.unread).length;
  let lastDay = '';

  return (
    <Shell active="notifications">
      <PageHeader
        crumbs={[{ label: 'Notifications' }]}
        actions={
          unreadCount > 0 && (
            <Button size="sm" icon={<HugeiconsIcon icon={TickDouble02Icon} className="size-3.5" />} loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              Mark all as read
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <TabBar
          className="mt-2"
          trailing={
            <span className="hidden items-center gap-1.5 text-[12px] text-subtle md:flex">
              <Kbd>E</Kbd> done · <Kbd>J</Kbd>
              <Kbd>K</Kbd> move
            </span>
          }
        >
          {(Object.keys(VIEWS) as View[]).map((key) => {
            const query = VIEWS[key].query;
            return <Tab key={key} href={query ? `/notifications?query=${encodeURIComponent(query)}` : '/notifications'} active={view === key} icon={VIEWS[key].icon} label={VIEWS[key].label} />;
          })}
        </TabBar>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="px-2 pb-1.5 text-[11px] font-medium text-subtle">Repositories</div>
            <RepoFilter active={repo === null} onClick={() => setRepo(null)} label="All repositories" count={unreadCount} />
            {repos.map(([name, { avatar, unread }]) => (
              <RepoFilter key={name} active={repo === name} onClick={() => setRepo(name)} label={name} avatar={avatar} count={unread} />
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
            ) : shown.length === 0 ? (
              <Panel>
                <Empty>{view === 'unread' ? 'All caught up.' : 'No notifications.'}</Empty>
              </Panel>
            ) : (
              <Panel className="animate-enter overflow-hidden">
                {shown.map((n) => {
                  const day = dayLabel(n.updated_at);
                  const header = day !== lastDay ? day : null;
                  lastDay = day;
                  return (
                    <div key={n.id}>
                      {header && <div className="border-b border-line bg-bg/40 px-4 py-1.5 text-[11.5px] font-medium text-subtle">{header}</div>}
                      <NotificationRow notification={n} onOpen={() => open(n)} onRead={() => markRead.mutate(n.id)} onDone={() => markDone.mutate(n.id)} />
                    </div>
                  );
                })}
                {list.hasNextPage && (
                  <div className="flex justify-center border-t border-line p-3">
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

function NotificationRow({ notification: n, onOpen, onRead, onDone }: { notification: Notification; onOpen: () => void; onRead: () => void; onDone: () => void }) {
  const [owner, name] = n.repository.full_name.split('/');
  return (
    <div
      data-row
      data-notification={n.id}
      tabIndex={0}
      role="link"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group flex h-12 cursor-pointer items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none"
    >
      <span className={cx('size-1.5 shrink-0 rounded-full', n.unread ? 'bg-accent' : 'bg-transparent')} />
      <span className={cx('flex size-4 shrink-0 items-center [&>svg]:size-4', n.unread ? 'text-fg' : 'text-subtle')}>{ICONS[n.subject.type] ?? <HugeiconsIcon icon={Notification03Icon} />}</span>
      <span className="flex w-[180px] shrink-0 items-center gap-1.5 truncate text-[12px] text-subtle">
        <Avatar src={n.repository.owner.avatar_url} size={14} square />
        <span className="truncate">
          {owner}/<span className="text-muted">{name}</span>
        </span>
      </span>
      <span className={cx('min-w-0 flex-1 truncate text-[13px]', n.unread ? 'font-medium text-fg' : 'text-muted')}>{n.subject.title}</span>
      <span
        className={cx(
          'hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] md:inline',
          LOUD.has(n.reason) ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line text-subtle',
        )}
      >
        {REASONS[n.reason] ?? n.reason.replace(/_/g, ' ')}
      </span>
      <span className="w-16 shrink-0 text-right text-[12px] text-subtle group-hover:hidden group-focus:hidden">{timeAgo(n.updated_at)}</span>
      <span className="hidden w-16 shrink-0 justify-end gap-0.5 group-hover:flex group-focus:flex">
        {n.unread && <RowAction label="Mark as read" icon={<HugeiconsIcon icon={Tick02Icon} />} onClick={onRead} />}
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-elevated hover:text-fg [&>svg]:size-3.5"
    >
      {icon}
    </button>
  );
}

function RepoFilter({ active, onClick, label, avatar, count }: { active: boolean; onClick: () => void; label: string; avatar?: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cx(
        'flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[12.5px]',
        active ? 'bg-hover font-medium text-fg' : 'text-muted hover:bg-hover hover:text-fg',
      )}
    >
      {avatar ? <Avatar src={avatar} size={14} square /> : <HugeiconsIcon icon={InboxIcon} className="size-3.5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count > 0 && <span className="text-[11px] text-subtle tabular-nums">{count}</span>}
    </button>
  );
}
