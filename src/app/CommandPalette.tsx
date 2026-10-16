import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Book02Icon, CircleDotIcon, ComputerIcon, GitPullRequestIcon, Home01Icon, KeyboardIcon, Moon02Icon, Notification03Icon, Search01Icon, Settings02Icon, StarIcon, Sun03Icon, UserIcon } from '@hugeicons/core-free-icons';
import { gql } from '@/github/client';
import { navigate } from '@/lib/navigation';
import { sessionLogin } from '@/lib/session';
import { themeItem } from '@/lib/settings';
import { cx } from '@/lib/cx';
import { formatCount } from '@/lib/time';
import { useDebounced } from '@/lib/useDebounced';
import { homeQueries } from '@/pages/home/queries';
import { useUnreadCount } from '@/pages/notifications/queries';
import type { ListPage } from '@/pages/work/queries';
import { Modal } from '@/ui/Modal';
import { Avatar, Kbd } from '@/ui/primitives';
import { IssueIcon, PrStateIcon } from '@/ui/status';
import { useCombobox } from '@/ui/useCombobox';
import type { IssueRowData, PrRowData } from '@/ui/WorkRow';
import { paletteOpen, registeredCommands, type Command } from './commands';
import { shortcutsOpen } from './keyboard';
import { settingsOpen } from './SettingsDialog';
import { appState } from './state';

const WORK_FIELDS = /* GraphQL */ `
  __typename
  ... on PullRequest { id number title url state isDraft repository { nameWithOwner } }
  ... on Issue { id number title url state stateReason repository { nameWithOwner } }
`;

const SEARCH_QUERY = /* GraphQL */ `
  query PaletteSearch($q: String!, $work: String!) {
    repos: search(type: REPOSITORY, query: $q, first: 6) {
      nodes { ... on Repository { nameWithOwner stargazerCount owner { avatarUrl } } }
    }
    users: search(type: USER, query: $q, first: 4) {
      nodes { ... on User { login name avatarUrl } ... on Organization { login name avatarUrl } }
    }
    work: search(type: ISSUE, query: $work, first: 8) { nodes { ${WORK_FIELDS} } }
  }
`;

const REF_QUERY = /* GraphQL */ `
  query PaletteRef($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) { issueOrPullRequest(number: $number) { ${WORK_FIELDS} } }
  }
`;

type RowFields = 'id' | 'number' | 'title' | 'url' | 'state' | 'repository';

/** A pull request or issue as the palette lists it. Cached list rows carry these fields too. */
type Work =
  | ({ __typename: 'PullRequest' } & Pick<PrRowData, RowFields | 'isDraft'>)
  | ({ __typename: 'Issue' } & Pick<IssueRowData, RowFields | 'stateReason'>);

type SearchResult = {
  repos: { nodes: ({ nameWithOwner: string; stargazerCount: number; owner: { avatarUrl: string } } | Record<string, never>)[] };
  users: { nodes: ({ login: string; name: string | null; avatarUrl: string } | Record<string, never>)[] };
  work: { nodes: Work[] };
};

const WORK_LIMIT = 8;

/** Commands that are always available, regardless of page: navigation, appearance and help. */
function navigationCommands(unread: string | null): Command[] {
  const login = sessionLogin();
  const go = (href: string) => () => navigate(href);
  return [
    { id: 'nav:home', group: 'Navigate', title: 'Home', icon: <HugeiconsIcon icon={Home01Icon} />, hint: 'G H', perform: go('/') },
    ...(login
      ? [{ id: 'nav:profile', group: 'Navigate', title: 'Your profile', icon: <HugeiconsIcon icon={UserIcon} />, hint: 'G P', perform: go(`/${login}`) }]
      : []),
    { id: 'nav:pulls', group: 'Navigate', title: 'Pull requests', icon: <HugeiconsIcon icon={GitPullRequestIcon} />, perform: go('/pulls') },
    { id: 'nav:issues', group: 'Navigate', title: 'Issues', icon: <HugeiconsIcon icon={CircleDotIcon} />, perform: go('/issues') },
    { id: 'nav:notifications', group: 'Navigate', title: 'Notifications', icon: <HugeiconsIcon icon={Notification03Icon} />, hint: unread ? `${unread} unread` : undefined, perform: go('/notifications') },
    { id: 'nav:stars', group: 'Navigate', title: 'Your stars', icon: <HugeiconsIcon icon={StarIcon} />, perform: go(login ? `/${login}?tab=stars` : '/stars') },
    { id: 'settings', group: 'Appearance', title: 'Settings', keywords: 'preferences token pages reload', icon: <HugeiconsIcon icon={Settings02Icon} />, perform: () => settingsOpen.set(true) },
    { id: 'theme:light', group: 'Appearance', title: 'Light theme', keywords: 'mode', icon: <HugeiconsIcon icon={Sun03Icon} />, perform: () => themeItem.setValue('light') },
    { id: 'theme:dark', group: 'Appearance', title: 'Dark theme', keywords: 'mode', icon: <HugeiconsIcon icon={Moon02Icon} />, perform: () => themeItem.setValue('dark') },
    { id: 'theme:auto', group: 'Appearance', title: 'Auto theme (match GitHub)', keywords: 'mode system', icon: <HugeiconsIcon icon={ComputerIcon} />, perform: () => themeItem.setValue('auto') },
    { id: 'shortcuts', group: 'Help', title: 'Keyboard shortcuts', keywords: 'keys hotkeys', icon: <HugeiconsIcon icon={KeyboardIcon} />, hint: '?', perform: () => shortcutsOpen.set(true) },
  ];
}

/** The repo on screen (repo and pull request pages), which a bare "#12" refers to. */
type Here = { owner: string; repo: string } | null;
type Ref = { owner: string; name: string; number: number };

/** "owner/repo#12", "owner/repo/pull/12", or a bare "#12" inside the repo on screen. */
function parseRef(q: string, here: Here): Ref | null {
  const full = q.match(/^([\w.-]+)\/([\w.-]+)(?:#|\/pull\/)(\d+)$/);
  if (full?.[1] && full[2]) return { owner: full[1], name: full[2], number: Number(full[3]) };
  const bare = q.match(/^#(\d+)$/);
  return bare && here ? { owner: here.owner, name: here.repo, number: Number(bare[1]) } : null;
}

function workCommand(item: Work, group = 'Pull requests & issues'): Command {
  return {
    id: `work:${item.id}`,
    group,
    title: item.title,
    hint: `${item.repository.nameWithOwner.split('/')[1]}#${item.number}`,
    icon: item.__typename === 'PullRequest' ? <PrStateIcon state={item.state} isDraft={item.isDraft} /> : <IssueIcon state={item.state} stateReason={item.stateReason} />,
    perform: () => navigate(item.url),
  };
}

/**
 * Turns a reference, "owner/repo" or "@login" into a direct jump. A reference opens what `resolved` says it
 * is; until that lands it goes to /issues/<n>, which GitHub redirects to the pull request when it is one.
 */
function directJump(q: string, here: Here, resolved?: Work | null): Command | null {
  const ref = parseRef(q, here);
  if (ref) {
    if (resolved) return { ...workCommand(resolved, 'Jump'), id: 'jump' };
    const { owner, name, number } = ref;
    return { id: 'jump', group: 'Jump', title: `Open ${owner}/${name}#${number}`, icon: <HugeiconsIcon icon={GitPullRequestIcon} />, perform: () => navigate(`/${owner}/${name}/issues/${number}`) };
  }
  const repo = q.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (repo) return { id: 'jump', group: 'Jump', title: `Open ${q}`, icon: <HugeiconsIcon icon={Book02Icon} />, perform: () => navigate(`/${q}`) };
  const user = q.match(/^@([\w-]+)$/);
  if (user) return { id: 'jump', group: 'Jump', title: `Open @${user[1]}`, icon: <HugeiconsIcon icon={UserIcon} />, perform: () => navigate(`/${user[1]}`) };
  return null;
}

/** Every word of `query` appears in `haystack`, ignoring case. */
function matches(haystack: string, query: string) {
  const text = haystack.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((word) => text.includes(word));
}

/** Pull requests and issues the home page and lists have already loaded, so title matches show at once. */
function cachedWork(client: QueryClient): Work[] {
  const prs = [homeQueries.reviewRequested(), homeQueries.authored(), homeQueries.merged()].flatMap((q) => client.getQueryData(q.queryKey)?.nodes ?? []);
  const issues = client.getQueryData(homeQueries.assigned().queryKey)?.nodes ?? [];
  const lists = client.getQueriesData<InfiniteData<ListPage>>({ queryKey: ['work'] }).flatMap(([, data]) => data?.pages.flatMap((page) => page.results.nodes) ?? []);
  return [...prs.map((pr) => ({ ...pr, __typename: 'PullRequest' as const })), ...issues.map((issue) => ({ ...issue, __typename: 'Issue' as const })), ...lists];
}

/** Raycast-style launcher: page actions, navigation, your pull requests and issues, and live GitHub search. */
export function CommandPalette() {
  const open = paletteOpen.use();
  if (!open) return null;
  return <PaletteDialog />;
}

function PaletteDialog() {
  const client = useQueryClient();
  const [query, setQuery] = useState('');
  const pageCommands = registeredCommands.use();
  const state = appState.use();
  const route = state.mode === 'own' ? state.route : null;
  const here = route && 'owner' in route ? route : null;
  const q = query.trim();
  const debounced = useDebounced(q, 180);
  // Results for an older query are dropped rather than shown under a newer one.
  const settled = debounced === q;
  const ref = parseRef(debounced, here);
  const unread = useUnreadCount();

  const search = useQuery({
    queryKey: ['palette', debounced],
    queryFn: () => gql<SearchResult>(SEARCH_QUERY, { q: debounced, work: `${debounced} in:title involves:@me` }),
    enabled: debounced.length >= 2 && !directJump(debounced, here),
    staleTime: 60_000,
  });

  const resolved = useQuery({
    queryKey: ['palette-ref', ref],
    queryFn: async () => (await gql<{ repository: { issueOrPullRequest: Work | null } | null }>(REF_QUERY, { ...ref })).repository?.issueOrPullRequest ?? null,
    enabled: !!ref,
    staleTime: 60_000,
    retry: false,
  });

  const items = useMemo(() => {
    const jump = directJump(q, here, settled ? resolved.data : undefined);
    const local = [...pageCommands, ...navigationCommands(unread)].filter((c) => !q || matches(`${c.title} ${c.keywords ?? ''} ${c.group}`, q));
    const remote: Command[] = [];
    if (q.length >= 2 && !jump) {
      // Cached title matches first, then the search's, once each.
      const cached = cachedWork(client).filter((item) => matches(`${item.title} ${item.repository.nameWithOwner}#${item.number}`, q));
      const found = settled ? (search.data?.work.nodes ?? []) : [];
      const work = [...new Map([...cached, ...found].map((item) => [item.id, item])).values()];
      remote.push(...work.slice(0, WORK_LIMIT).map((item) => workCommand(item)));
    }
    if (search.data && settled) {
      for (const repo of search.data.repos.nodes) {
        if (!('nameWithOwner' in repo)) continue;
        remote.push({
          id: `repo:${repo.nameWithOwner}`,
          group: 'Repositories',
          title: repo.nameWithOwner,
          hint: `★ ${formatCount(repo.stargazerCount)}`,
          icon: <Avatar src={repo.owner.avatarUrl} size={16} square />,
          perform: () => navigate(`/${repo.nameWithOwner}`),
        });
      }
      for (const user of search.data.users.nodes) {
        if (!('login' in user)) continue;
        remote.push({
          id: `user:${user.login}`,
          group: 'People',
          title: user.name ? `${user.name}` : user.login,
          hint: `@${user.login}`,
          icon: <Avatar src={user.avatarUrl} size={16} />,
          perform: () => navigate(`/${user.login}`),
        });
      }
    }
    return [...(jump ? [jump] : []), ...local, ...remote];
  }, [q, here, settled, resolved.data, pageCommands, client, search.data, unread]);

  const close = () => paletteOpen.set(false);
  const run = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.perform();
  };
  const combobox = useCombobox({ count: items.length, query, label: 'Results', pick: (i) => run(items[i]) });

  // Consecutive items of a group sit under one heading.
  const groups: { name: string; entries: { item: Command; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const last = groups.at(-1);
    if (last?.name === item.group) last.entries.push({ item, index });
    else groups.push({ name: item.group, entries: [{ item, index }] });
  });

  return (
    <Modal label="Command palette" onClose={close} className="w-[640px]">
      <div className="flex h-12 items-center gap-3 border-b border-line px-4">
        <HugeiconsIcon icon={Search01Icon} className="size-4 text-subtle" />
        <input
          {...combobox.input}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search or run a command"
          placeholder={`Search repos, people, your PRs and issues, or run a command…  (try ${here ? '#123' : 'owner/repo#123'})`}
          className="h-full flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-subtle"
        />
        {(search.isFetching || resolved.isFetching) && <span className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-accent" />}
      </div>
      <div {...combobox.list} className="max-h-[52vh] overflow-y-auto p-1.5">
        {items.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-subtle">No results</div>}
        {groups.map((group, g) => (
          <div key={`${group.name}:${g}`} role="group" aria-labelledby={`${combobox.list.id}-g${g}`}>
            <div id={`${combobox.list.id}-g${g}`} className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium text-subtle">
              {group.name}
            </div>
            {group.entries.map(({ item, index }) => (
              <div
                key={item.id}
                {...combobox.option(index)}
                className={cx(
                  'flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left text-[13px] [&_svg]:size-4',
                  index === combobox.active ? 'bg-hover text-fg' : 'text-fg/90',
                )}
              >
                {/* Muted unless the icon sets its own color (pull request and issue states). */}
                <span className="flex size-4 items-center justify-center text-muted">{item.icon}</span>
                <span className="truncate">{item.title}</span>
                {item.hint && <span className="ml-auto shrink-0 text-[12px] text-subtle">{item.hint}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex h-10 items-center gap-4 border-t border-line px-4 text-[11.5px] text-subtle">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>esc</Kbd> close
        </span>
        <span className="ml-auto font-medium text-muted">Unmerged</span>
      </div>
    </Modal>
  );
}
