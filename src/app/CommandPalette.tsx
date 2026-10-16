import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Book02Icon, CircleDotIcon, ComputerIcon, GitPullRequestIcon, Home01Icon, Moon02Icon, Notification03Icon, Search01Icon, Settings02Icon, StarIcon, Sun03Icon, UserIcon } from '@hugeicons/core-free-icons';
import { gql } from '@/github/client';
import { navigate } from '@/lib/navigation';
import { sessionLogin } from '@/lib/session';
import { themeItem } from '@/lib/settings';
import { cx } from '@/lib/cx';
import { formatCount } from '@/lib/time';
import { Avatar, Kbd } from '@/ui/primitives';
import { paletteOpen, registeredCommands, type Command } from './commands';
import { settingsOpen } from './SettingsDialog';

const SEARCH_QUERY = /* GraphQL */ `
  query PaletteSearch($q: String!) {
    repos: search(type: REPOSITORY, query: $q, first: 6) {
      nodes { ... on Repository { nameWithOwner stargazerCount owner { avatarUrl } } }
    }
    users: search(type: USER, query: $q, first: 4) {
      nodes { ... on User { login name avatarUrl } ... on Organization { login name avatarUrl } }
    }
  }
`;

type SearchResult = {
  repos: { nodes: ({ nameWithOwner: string; stargazerCount: number; owner: { avatarUrl: string } } | Record<string, never>)[] };
  users: { nodes: ({ login: string; name: string | null; avatarUrl: string } | Record<string, never>)[] };
};

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Commands that are always available, regardless of page: navigation and appearance. */
function navigationCommands(): Command[] {
  const login = sessionLogin();
  const go = (href: string) => () => navigate(href);
  return [
    { id: 'nav:home', group: 'Navigate', title: 'Home', icon: <HugeiconsIcon icon={Home01Icon} />, hint: 'G H', perform: go('/') },
    ...(login
      ? [{ id: 'nav:profile', group: 'Navigate', title: 'Your profile', icon: <HugeiconsIcon icon={UserIcon} />, hint: 'G P', perform: go(`/${login}`) }]
      : []),
    { id: 'nav:pulls', group: 'Navigate', title: 'Pull requests', icon: <HugeiconsIcon icon={GitPullRequestIcon} />, perform: go('/pulls') },
    { id: 'nav:issues', group: 'Navigate', title: 'Issues', icon: <HugeiconsIcon icon={CircleDotIcon} />, perform: go('/issues') },
    { id: 'nav:notifications', group: 'Navigate', title: 'Notifications', icon: <HugeiconsIcon icon={Notification03Icon} />, perform: go('/notifications') },
    { id: 'nav:stars', group: 'Navigate', title: 'Your stars', icon: <HugeiconsIcon icon={StarIcon} />, perform: go(login ? `/${login}?tab=stars` : '/stars') },
    { id: 'settings', group: 'Appearance', title: 'Settings', keywords: 'preferences token pages reload', icon: <HugeiconsIcon icon={Settings02Icon} />, perform: () => settingsOpen.set(true) },
    { id: 'theme:light', group: 'Appearance', title: 'Light theme', keywords: 'mode', icon: <HugeiconsIcon icon={Sun03Icon} />, perform: () => themeItem.setValue('light') },
    { id: 'theme:dark', group: 'Appearance', title: 'Dark theme', keywords: 'mode', icon: <HugeiconsIcon icon={Moon02Icon} />, perform: () => themeItem.setValue('dark') },
    { id: 'theme:auto', group: 'Appearance', title: 'Auto theme (match GitHub)', keywords: 'mode system', icon: <HugeiconsIcon icon={ComputerIcon} />, perform: () => themeItem.setValue('auto') },
  ];
}

/** Turns "owner/repo#12", "owner/repo" or "@login" into a direct jump. */
function directJump(query: string): Command | null {
  const q = query.trim();
  const pr = q.match(/^([\w.-]+)\/([\w.-]+)(?:#|\/pull\/)(\d+)$/);
  if (pr) {
    return { id: 'jump', group: 'Jump', title: `Open ${pr[1]}/${pr[2]}#${pr[3]}`, icon: <HugeiconsIcon icon={GitPullRequestIcon} />, perform: () => navigate(`/${pr[1]}/${pr[2]}/pull/${pr[3]}`) };
  }
  const repo = q.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (repo) return { id: 'jump', group: 'Jump', title: `Open ${q}`, icon: <HugeiconsIcon icon={Book02Icon} />, perform: () => navigate(`/${q}`) };
  const user = q.match(/^@([\w-]+)$/);
  if (user) return { id: 'jump', group: 'Jump', title: `Open @${user[1]}`, icon: <HugeiconsIcon icon={UserIcon} />, perform: () => navigate(`/${user[1]}`) };
  return null;
}

function matches(command: Command, query: string) {
  if (!query) return true;
  const haystack = `${command.title} ${command.keywords ?? ''} ${command.group}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
}

/** Raycast-style launcher: page actions, navigation, and live GitHub search. */
export function CommandPalette() {
  const open = paletteOpen.use();
  if (!open) return null;
  return <PaletteDialog />;
}

function PaletteDialog() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pageCommands = registeredCommands.use();
  const debounced = useDebounced(query.trim(), 180);

  const search = useQuery({
    queryKey: ['palette', debounced],
    queryFn: () => gql<SearchResult>(SEARCH_QUERY, { q: debounced }),
    enabled: debounced.length >= 2 && !directJump(debounced),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const jump = directJump(query);
    const local = [...pageCommands, ...navigationCommands()].filter((c) => matches(c, query));
    const remote: Command[] = [];
    if (search.data && debounced === query.trim()) {
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
  }, [query, pageCommands, search.data, debounced]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = () => paletteOpen.set(false);
  const run = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.perform();
  };

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[14vh] backdrop-blur-[2px]" onPointerDown={close}>
      <div
        className="w-[640px] max-w-[calc(100vw-32px)] animate-pop overflow-hidden rounded-2xl border border-line-strong bg-elevated shadow-2xl shadow-black/50"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-3 border-b border-line px-4">
          <HugeiconsIcon icon={Search01Icon} className="size-4 text-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(items[active]);
              } else if (e.key === 'Escape') {
                close();
              }
            }}
            placeholder="Search repos, people, or run a command…  (try owner/repo#123)"
            className="h-full flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-subtle"
          />
          {search.isFetching && <span className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-accent" />}
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {items.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-subtle">No results</div>}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium text-subtle">{header}</div>}
                <button
                  type="button"
                  data-active={index === active}
                  onPointerMove={() => setActive(index)}
                  onClick={() => run(item)}
                  className={cx(
                    'flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left text-[13px] [&_svg]:size-4 [&_svg]:text-muted',
                    index === active ? 'bg-hover text-fg' : 'text-fg/90',
                  )}
                >
                  <span className="flex size-4 items-center justify-center">{item.icon}</span>
                  <span className="truncate">{item.title}</span>
                  {item.hint && <span className="ml-auto shrink-0 text-[12px] text-subtle">{item.hint}</span>}
                </button>
              </div>
            );
          })}
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
      </div>
    </div>
  );
}
