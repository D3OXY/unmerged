import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Cancel01Icon, GitForkIcon, JusticeScale01Icon, Search01Icon, SquareLock02Icon, StarIcon } from '@hugeicons/core-free-icons';
import { gql } from '@/github/client';
import { usePageHotkey } from '@/app/keyboard';
import { REPO_MUTATIONS } from '@/pages/repo/query';
import { cx } from '@/lib/cx';
import { formatCount, timeAgo } from '@/lib/time';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Empty, Kbd, LanguageDot, Panel, Pill, Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import { ProfileFrame } from './ProfileFrame';
import { profileReposQuery, type OwnedRepo as Repo } from './queries';

// The `type` values GitHub uses in its own URLs, so links into this page keep working.
const TYPES = {
  all: { label: 'All', test: () => true },
  source: { label: 'Sources', test: (r) => !r.isFork },
  fork: { label: 'Forks', test: (r) => r.isFork },
  public: { label: 'Public', test: (r) => !r.isPrivate },
  private: { label: 'Private', test: (r) => r.isPrivate },
  archived: { label: 'Archived', test: (r) => r.isArchived },
  mirror: { label: 'Mirrors', test: (r) => r.isMirror },
  template: { label: 'Templates', test: (r) => r.isTemplate },
} satisfies Record<string, { label: string; test: (repo: Repo) => boolean }>;

type RepoType = keyof typeof TYPES;

const SORTS = {
  updated: { label: 'Last updated', compare: (a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '') },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) },
  stargazers: { label: 'Stars', compare: (a, b) => b.stargazerCount - a.stargazerCount },
} satisfies Record<string, { label: string; compare: (a: Repo, b: Repo) => number }>;

type Sort = keyof typeof SORTS;

/** Filters as GitHub writes them in the URL (`q`, `type`, `language`, `sort`); defaults are left out. */
type Filters = { q: string; type: RepoType; language: string; sort: Sort };

const isKey = <T extends object>(map: T, key: string | null): key is Extract<keyof T, string> => key !== null && Object.hasOwn(map, key);

// GitHub's organization pages turn `language=` into a `lang:` qualifier in `q` (redirecting to it on load).
const LANG_QUALIFIER = /(?:^|\s)lang:(?:"([^"]+)"|(\S+))/i;

function readFilters(): Filters {
  const params = new URL(location.href).searchParams;
  const type = params.get('type');
  const sort = params.get('sort');
  const q = params.get('q') ?? '';
  const [qualifier, quoted, bare] = q.match(LANG_QUALIFIER) ?? [];
  return {
    q: qualifier ? q.replace(qualifier, '').trim() : q,
    type: isKey(TYPES, type) ? type : 'all',
    language: (params.get('language') ?? quoted ?? bare ?? '').toLowerCase(),
    sort: isKey(SORTS, sort) ? sort : 'updated',
  };
}

function writeFilters({ q, type, language, sort }: Filters) {
  const url = new URL(location.href);
  const set = (key: string, value: string, fallback: string) => (value === fallback ? url.searchParams.delete(key) : url.searchParams.set(key, value));
  set('q', q.trim(), '');
  set('type', type, 'all');
  set('language', language, '');
  set('sort', sort, 'updated');
  history.replaceState(history.state, '', url);
}

// Background loading stops here: a few orgs own thousands of repositories (Microsoft ~8,000), more than
// one list should hold. The most recently pushed are kept, matching the default sort.
const MAX_PAGES = 20;

export function RepositoriesPage({ login }: { login: string }) {
  return (
    <ProfileFrame login={login} tab="repositories">
      <RepositoryList login={login} />
    </ProfileFrame>
  );
}

/**
 * Every repository a user or organization owns, loaded in full (100 per request, in the background, up to
 * MAX_PAGES) so search, type, language and sort all apply instantly on the client.
 */
export function RepositoryList({ login }: { login: string }) {
  const queryClient = useQueryClient();
  const options = profileReposQuery(login);
  const query = useInfiniteQuery(options);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const capped = hasNextPage && (query.data?.pages.length ?? 0) >= MAX_PAGES;
  useEffect(() => {
    if (hasNextPage && !capped && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, capped, isFetchingNextPage, fetchNextPage]);

  const [filters, setFilters] = useState(readFilters);
  const update = (changes: Partial<Filters>) => setFilters((f) => ({ ...f, ...changes }));
  useEffect(() => writeFilters(filters), [filters]);

  const searchRef = useRef<HTMLInputElement>(null);
  usePageHotkey('/', useCallback(() => searchRef.current?.focus(), []), 'Find a repository');

  const repos = useMemo(() => query.data?.pages.flatMap((page) => page?.nodes ?? []) ?? [], [query.data]);
  const total = query.data?.pages[0]?.totalCount ?? 0;

  const languages = useMemo(() => {
    const counts = new Map<string, { name: string; color: string | null; count: number }>();
    for (const { primaryLanguage: lang } of repos) {
      if (!lang) continue;
      const entry = counts.get(lang.name.toLowerCase()) ?? { ...lang, count: 0 };
      entry.count++;
      counts.set(lang.name.toLowerCase(), entry);
    }
    return [...counts].sort(([, a], [, b]) => b.count - a.count);
  }, [repos]);

  const shown = useMemo(() => {
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    return repos
      .filter(
        (repo) =>
          TYPES[filters.type].test(repo) &&
          (!filters.language || repo.primaryLanguage?.name.toLowerCase() === filters.language) &&
          words.every((word) =>
            [repo.name, repo.description ?? '', ...repo.repositoryTopics.nodes.map((t) => t.topic.name)].join(' ').toLowerCase().includes(word),
          ),
      )
      .sort(SORTS[filters.sort].compare);
  }, [repos, filters]);

  const countOf = (type: RepoType) => repos.filter(TYPES[type].test).length;

  // A page fetch already in flight would land after the patch and undo it, so it's cancelled first (the
  // background loading above resumes on its own).
  const patchRepo = async (id: string, changes: Partial<Repo>) => {
    await queryClient.cancelQueries({ queryKey: options.queryKey });
    queryClient.setQueryData(options.queryKey, (data) =>
      data && { ...data, pages: data.pages.map((page) => page && { ...page, nodes: page.nodes.map((r) => (r.id === id ? { ...r, ...changes } : r)) }) },
    );
  };

  const filtered = filters.q.trim() !== '' || filters.type !== 'all' || filters.language !== '';
  const languageName = languages.find(([key]) => key === filters.language)?.[1].name ?? filters.language;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 transition-colors focus-within:border-accent/60">
          <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0 text-subtle" />
          <input
            ref={searchRef}
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && (filters.q ? update({ q: '' }) : e.currentTarget.blur())}
            placeholder="Find a repository…"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle"
          />
          {!filters.q && <Kbd>/</Kbd>}
        </label>
        <Filter
          label="Type"
          value={filters.type}
          display={TYPES[filters.type].label}
          options={(Object.keys(TYPES) as RepoType[])
            .map((key) => ({ value: key, label: TYPES[key].label, count: countOf(key) }))
            .filter(({ value, count }) => value === 'all' || value === filters.type || count > 0)
            .map(({ count, ...option }) => ({ ...option, hint: `${count} repositories` }))}
          onChange={(type) => update({ type })}
        />
        <Filter
          label="Language"
          value={filters.language || 'all'}
          display={filters.language ? languageName : 'All'}
          options={[
            { value: 'all', label: 'All languages' },
            ...languages.map(([key, { name, count }]) => ({ value: key, label: name, hint: `${count} repositories` })),
          ]}
          onChange={(language) => update({ language: language === 'all' ? '' : language })}
        />
        <Filter
          label="Sort"
          value={filters.sort}
          display={SORTS[filters.sort].label}
          options={(Object.keys(SORTS) as Sort[]).map((key) => ({ value: key, label: SORTS[key].label }))}
          onChange={(sort) => update({ sort })}
        />
      </div>

      <div className="mt-4 flex min-h-7 flex-wrap items-center gap-2 px-1 text-[12.5px] text-muted">
        {query.isPending ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <span>
            <span className="font-medium text-fg tabular-nums">{shown.length.toLocaleString()}</span>
            {filtered ? ` of ${total.toLocaleString()}` : ''} {total === 1 ? 'repository' : 'repositories'}
          </span>
        )}
        {filters.type !== 'all' && <Chip onRemove={() => update({ type: 'all' })}>{TYPES[filters.type].label}</Chip>}
        {filters.language && <Chip onRemove={() => update({ language: '' })}>{languageName}</Chip>}
        {filters.q.trim() && <Chip onRemove={() => update({ q: '' })}>“{filters.q.trim()}”</Chip>}
        {filtered && (
          <button type="button" onClick={() => update({ q: '', type: 'all', language: '' })} className="cursor-pointer text-subtle hover:text-fg">
            Clear all
          </button>
        )}
        {capped ? (
          <a
            href={`/search?type=repositories&q=${encodeURIComponent(`user:${login} ${filters.q}`.trim())}`}
            className="ml-auto text-subtle hover:text-fg"
          >
            The {repos.length.toLocaleString()} most recently pushed · search all on GitHub
          </a>
        ) : hasNextPage && (
          <span className="ml-auto flex items-center gap-2 text-subtle">
            <span className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            Loading {repos.length.toLocaleString()} of {total.toLocaleString()}
          </span>
        )}
      </div>

      {query.error ? (
        <p className="py-10 text-danger">{query.error.message}</p>
      ) : query.isPending ? (
        <div className="mt-2 flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))}
        </div>
      ) : (
        <Panel className="mt-2 animate-enter overflow-hidden">
          {shown.length === 0 &&
            (filtered ? (
              <Empty>
                No repositories match.{' '}
                <button type="button" onClick={() => update({ q: '', type: 'all', language: '' })} className="cursor-pointer text-accent hover:underline">
                  Clear filters
                </button>
              </Empty>
            ) : (
              <Empty>No repositories yet.</Empty>
            ))}
          {shown.map((repo) => (
            <RepoRow key={repo.id} repo={repo} onChange={(changes) => patchRepo(repo.id, changes)} />
          ))}
        </Panel>
      )}
    </>
  );
}

function Filter<T extends string>({
  label,
  value,
  display,
  options,
  onChange,
}: {
  label: string;
  value: T;
  display: string;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Menu<T>
      value={value}
      options={options}
      onChange={onChange}
      trigger={(open) => (
        <Button onClick={open}>
          <span className="font-normal text-muted">{label}</span>
          {display}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-subtle" />
        </Button>
      )}
    />
  );
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-panel pr-1 pl-2.5 text-[12px] text-fg">
      {children}
      <button type="button" onClick={onRemove} aria-label="Remove filter" className="flex size-4 cursor-pointer items-center justify-center rounded-full text-subtle hover:bg-hover hover:text-fg">
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
      </button>
    </span>
  );
}

/**
 * A repository with its description, topics, stats and a star button. `onChange` patches the cached repo:
 * optimistically on star/unstar, and back if GitHub refuses. `fullName` shows "owner/name" (search results).
 */
export function RepoRow({ repo, onChange, fullName }: { repo: Repo; onChange: (changes: Partial<Repo>) => Promise<void>; fullName?: boolean }) {
  const star = useMutation({
    mutationFn: (starred: boolean) => gql(starred ? REPO_MUTATIONS.unstar : REPO_MUTATIONS.star, { id: repo.id }),
    onMutate: async (starred) => {
      const before = { viewerHasStarred: repo.viewerHasStarred, stargazerCount: repo.stargazerCount };
      await onChange({ viewerHasStarred: !starred, stargazerCount: repo.stargazerCount + (starred ? -1 : 1) });
      return before;
    },
    onError: (error, _, before) => {
      toast.error(error);
      if (before) onChange(before);
    },
  });
  const topics = repo.repositoryTopics.nodes;

  return (
    <div className="flex gap-4 border-b border-line px-4 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a href={repo.url} data-row className="truncate rounded text-[14.5px] font-semibold hover:underline focus:outline-none focus-visible:underline">
            {fullName ? repo.nameWithOwner : repo.name}
          </a>
          {repo.isPrivate && (
            <Pill>
              <HugeiconsIcon icon={SquareLock02Icon} className="size-2.5" />
              Private
            </Pill>
          )}
          {repo.isArchived && <Pill className="border-warning/40 text-warning">Archived</Pill>}
          {repo.isTemplate && <Pill>Template</Pill>}
          {repo.isMirror && <Pill>Mirror</Pill>}
        </div>
        {repo.parent && (
          <div className="mt-0.5 text-[12px] text-subtle">
            Forked from{' '}
            <a href={`/${repo.parent.nameWithOwner}`} className="hover:text-fg hover:underline">
              {repo.parent.nameWithOwner}
            </a>
          </div>
        )}
        {repo.description && <p className="mt-1 line-clamp-2 max-w-[720px] text-[13px] leading-snug text-muted">{repo.description}</p>}
        {topics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topics.map(({ topic }) => (
              <a
                key={topic.name}
                href={`/topics/${topic.name}`}
                className="rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent transition-colors hover:bg-accent/20"
              >
                {topic.name}
              </a>
            ))}
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-subtle [&_svg]:size-3">
          {repo.primaryLanguage && (
            <span className="flex items-center gap-1.5">
              <LanguageDot color={repo.primaryLanguage.color} />
              {repo.primaryLanguage.name}
            </span>
          )}
          {repo.stargazerCount > 0 && (
            <a href={`${repo.url}/stargazers`} className="flex items-center gap-1 hover:text-fg">
              <HugeiconsIcon icon={StarIcon} />
              {formatCount(repo.stargazerCount)}
            </a>
          )}
          {repo.forkCount > 0 && (
            <a href={`${repo.url}/forks`} className="flex items-center gap-1 hover:text-fg">
              <HugeiconsIcon icon={GitForkIcon} />
              {formatCount(repo.forkCount)}
            </a>
          )}
          {repo.licenseInfo && repo.licenseInfo.spdxId !== 'NOASSERTION' && (
            <span className="flex items-center gap-1" title={repo.licenseInfo.name}>
              <HugeiconsIcon icon={JusticeScale01Icon} />
              {repo.licenseInfo.spdxId ?? repo.licenseInfo.name}
            </span>
          )}
          {repo.pushedAt && <span>Updated {timeAgo(repo.pushedAt)}</span>}
        </div>
      </div>
      <div className="shrink-0">
        <Button
          size="sm"
          variant={repo.viewerHasStarred ? 'secondary' : 'ghost'}
          icon={<HugeiconsIcon icon={StarIcon} className={cx('size-3.5', repo.viewerHasStarred && 'fill-warning text-warning')} />}
          onClick={() => star.mutate(repo.viewerHasStarred)}
        >
          {repo.viewerHasStarred ? 'Starred' : 'Star'}
        </Button>
      </div>
    </div>
  );
}
