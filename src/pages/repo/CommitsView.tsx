import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, History, Users, X } from 'lucide-react';
import { gql, rest } from '@/github/client';
import { formatDate } from '@/lib/time';
import { Button } from '@/ui/Button';
import { COMMIT_ROW_FIELDS, CommitList, type CommitRowData } from '@/ui/CommitList';
import { Menu } from '@/ui/Menu';
import { Empty, Panel } from '@/ui/primitives';
import { BranchPicker } from './BranchPicker';
import type { Repo } from './query';
import { TreeSkeleton } from './TreeView';
import { commitsUrl, treeUrl } from './urls';

const HISTORY_QUERY = /* GraphQL */ `
  query RepoCommits($owner: String!, $name: String!, $ref: String!, $path: String, $author: CommitAuthor, $since: GitTimestamp, $until: GitTimestamp, $after: String) {
    repository(owner: $owner, name: $name) {
      object(expression: $ref) {
        ... on Commit {
          history(first: 50, after: $after, path: $path, author: $author, since: $since, until: $until) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { ...CommitRow }
          }
        }
      }
    }
  }
  ${COMMIT_ROW_FIELDS}
`;

type HistoryPage = {
  repository: {
    object: { history?: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: CommitRowData[] } } | null;
  } | null;
};

type Contributor = { login: string; type: string };

/** GitHub's own commit-list params; empty means unset. */
type Filters = { author: string; since: string; until: string };

const readFilters = (): Filters => {
  const params = new URL(location.href).searchParams;
  return { author: params.get('author') ?? '', since: params.get('since') ?? '', until: params.get('until') ?? '' };
};

/** "?author=…&since=…" for the set filters, or "". */
const searchFor = (filters: Filters) => {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return params.size ? `?${params}` : '';
};

const PRESETS = { all: ['All time', 0], week: ['Past week', 7], month: ['Past month', 30], year: ['Past year', 365] } as const;
type Preset = keyof typeof PRESETS;

/** The local day `days` ago as YYYY-MM-DD (the Canadian locale formats dates that way). */
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toLocaleDateString('en-CA');

/** A `since`/`until` value as a timestamp, or "" if unset or unreadable. Bare days are local; `until` includes its whole day. */
function toTimestamp(value: string, endOfDay: boolean) {
  const date = new Date(/^\d{4}-\d\d-\d\d$/.test(value) ? `${value}T${endOfDay ? '23:59:59' : '00:00'}` : value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
}

/** A repo's history on a ref, optionally for one path, filtered by author and date like GitHub's /commits. */
export function CommitsView({ repo, gitRef, path }: { repo: Repo; gitRef: string; path: string }) {
  const [owner, name] = repo.nameWithOwner.split('/') as [string, string];
  const [filters, setFilters] = useState(readFilters);
  const search = searchFor(filters);
  const since = toTimestamp(filters.since, false);
  const until = toTimestamp(filters.until, true);

  useEffect(() => {
    history.replaceState(history.state, '', `${location.pathname}${search}`);
  }, [search]);

  const contributors = useQuery({
    queryKey: ['repo-commit-authors', repo.nameWithOwner],
    queryFn: () => rest<Contributor[] | undefined>(`/repos/${repo.nameWithOwner}/contributors?per_page=20`),
    staleTime: 10 * 60_000,
  });

  // History filters by user ID, not login.
  const author = useQuery({
    queryKey: ['user-id', filters.author.toLowerCase()],
    queryFn: () => gql<{ user: { id: string } | null }>(`query UserId($login: String!) { user(login: $login) { id } }`, { login: filters.author }, true),
    enabled: !!filters.author,
    staleTime: Infinity,
  });
  const authorId = author.data?.user?.id;

  const list = useInfiniteQuery({
    queryKey: ['repo-commits', repo.nameWithOwner, gitRef, path, authorId, since, until],
    queryFn: ({ pageParam }) =>
      gql<HistoryPage>(HISTORY_QUERY, {
        owner,
        name,
        ref: gitRef,
        path: path || null,
        author: authorId ? { id: authorId } : null,
        since: since || null,
        until: until || null,
        after: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      const page = last.repository?.object?.history?.pageInfo;
      return page?.hasNextPage ? page.endCursor : null;
    },
    enabled: !filters.author || !!authorId,
    staleTime: 30_000,
  });

  const commits = list.data?.pages.flatMap((page) => page.repository?.object?.history?.nodes ?? []) ?? [];
  const total = list.data?.pages[0]?.repository?.object?.history?.totalCount;
  const error = list.error ?? author.error ?? (author.data && !authorId ? new Error(`No GitHub user named ${filters.author}.`) : null);

  // Bots can't be looked up as users, so they can't be filtered on.
  const authors = contributors.data?.filter((c) => c.type === 'User').map((c) => c.login) ?? [];
  if (filters.author && !authors.some((login) => login.toLowerCase() === filters.author.toLowerCase())) authors.unshift(filters.author);

  const preset = (Object.keys(PRESETS) as Preset[]).find((key) =>
    key === 'all' ? !filters.since && !filters.until : !filters.until && filters.since === daysAgo(PRESETS[key][1]),
  );
  const range = [since && `Since ${formatDate(since)}`, until && `until ${formatDate(until)}`].filter(Boolean).join(' ') || PRESETS.all[0];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BranchPicker owner={owner} name={name} current={gitRef} hrefFor={(ref) => commitsUrl(repo.nameWithOwner, ref, path) + search} />
        {path ? (
          <span className="flex min-w-0 items-center gap-1.5 px-1 text-[12.5px] text-muted">
            History for
            <a href={treeUrl(repo.nameWithOwner, gitRef, path)} className="truncate font-mono font-medium text-accent hover:underline">
              {path}
            </a>
            <a href={commitsUrl(repo.nameWithOwner, gitRef) + search} title="Show all files" className="flex size-6 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
              <X className="size-3.5" />
            </a>
          </span>
        ) : (
          total !== undefined && (
            <span className="flex items-center gap-1.5 px-2 text-[12.5px] text-muted">
              <History className="size-3.5 text-subtle" />
              <b className="font-medium text-fg tabular-nums">{total.toLocaleString()}</b> commits
            </span>
          )
        )}
        <div className="ml-auto flex items-center gap-2">
          <Menu<string>
            value={filters.author}
            options={[{ value: '', label: 'All users' }, ...authors.map((login) => ({ value: login, label: login }))]}
            onChange={(login) => setFilters((f) => ({ ...f, author: login }))}
            trigger={(open) => (
              <Button onClick={open} icon={<Users className="size-3.5 text-subtle" />}>
                {filters.author || 'All users'}
                <ChevronDown className="size-3.5 text-subtle" />
              </Button>
            )}
          />
          <Menu<Preset | 'custom'>
            value={preset ?? 'custom'}
            options={[
              ...(Object.keys(PRESETS) as Preset[]).map((key) => ({ value: key, label: PRESETS[key][0] })),
              ...(preset ? [] : [{ value: 'custom' as const, label: range }]),
            ]}
            onChange={(key) => key !== 'custom' && setFilters((f) => ({ ...f, since: key === 'all' ? '' : daysAgo(PRESETS[key][1]), until: '' }))}
            trigger={(open) => (
              <Button onClick={open} icon={<CalendarDays className="size-3.5 text-subtle" />}>
                {preset ? PRESETS[preset][0] : range}
                <ChevronDown className="size-3.5 text-subtle" />
              </Button>
            )}
          />
        </div>
      </div>

      {error ? (
        <p className="py-10 text-[13px] text-danger">{error.message}</p>
      ) : list.isPending ? (
        <TreeSkeleton />
      ) : commits.length === 0 ? (
        <Panel>
          <Empty>
            No commits match.
            {search && (
              <button type="button" onClick={() => setFilters({ author: '', since: '', until: '' })} className="ml-2 cursor-pointer text-muted hover:text-fg">
                Clear filters
              </button>
            )}
          </Empty>
        </Panel>
      ) : (
        <div className="animate-enter">
          <CommitList commits={commits} nameWithOwner={repo.nameWithOwner} />
          {list.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button size="sm" variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
