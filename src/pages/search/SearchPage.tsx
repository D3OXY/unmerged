import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useQueries, useQueryClient, type DataTag, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ArrowUpDownIcon,
  Book02Icon,
  CircleDotIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  Search01Icon,
  SourceCodeIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { PageHeader, Shell } from '@/app/Shell';
import { usePageHotkey } from '@/app/keyboard';
import { navigate } from '@/lib/navigation';
import { SEARCH_TYPES, type SearchType } from '@/lib/routes';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { RepoRow } from '@/pages/profile/RepositoriesPage';
import { PersonRow } from '@/pages/profile/FollowsPage';
import { squash } from '@/pages/work/queries';
import { Button } from '@/ui/Button';
import { Menu } from '@/ui/Menu';
import { Avatar, Empty, Kbd, Panel, Skeleton } from '@/ui/primitives';
import { Tab, TabBar } from '@/ui/Tabs';
import { repoLabelFor, WorkRow } from '@/ui/WorkRow';
import { Highlighted } from './highlight';
import {
  codeSearchQuery,
  commitSearchQuery,
  isCounted,
  repoSearchQuery,
  searchCountQuery,
  searchHref,
  SORTS,
  sortOf,
  userSearchQuery,
  workSearchQuery,
  type Page,
  type SearchRoute,
} from './queries';

const TABS: Record<SearchType, { label: string; icon: IconSvgElement }> = {
  repositories: { label: 'Repositories', icon: Book02Icon },
  code: { label: 'Code', icon: SourceCodeIcon },
  issues: { label: 'Issues', icon: CircleDotIcon },
  pullrequests: { label: 'Pull requests', icon: GitPullRequestIcon },
  users: { label: 'Users', icon: UserGroupIcon },
  commits: { label: 'Commits', icon: GitCommitHorizontalIcon },
};

/**
 * GitHub search (`/search?q=…&type=…`): a tab per result type with its count, the query, and a sort. The URL is
 * the whole state, so a new query, tab or sort is a navigation. Counts load on their own and never hold up results.
 */
export function SearchPage(route: SearchRoute) {
  const { q, type } = route;
  const sort = sortOf(route);
  useTitle(q ? `${q} · Search` : 'Search');

  const [draft, setDraft] = useState(q);
  const searchRef = useRef<HTMLInputElement>(null);
  usePageHotkey('/', useCallback(() => searchRef.current?.focus(), []), 'Search');

  const counted = SEARCH_TYPES.filter(isCounted);
  const counts = useQueries({ queries: counted.map((tab) => searchCountQuery(q, tab)) });
  const countOf = (tab: SearchType) => (isCounted(tab) ? counts[counted.indexOf(tab)]?.data : undefined);
  const sorts = SORTS[type];

  return (
    <Shell>
      <PageHeader crumbs={[{ label: 'Search' }]} />
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <TabBar className="mt-2 mb-5">
          {SEARCH_TYPES.map((tab) => (
            <Tab
              key={tab}
              href={searchHref({ q, type: tab, sort: sortOf({ type: tab, sort }) })}
              active={tab === type}
              icon={<HugeiconsIcon icon={TABS[tab].icon} />}
              label={TABS[tab].label}
              count={countOf(tab)}
            />
          ))}
        </TabBar>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = squash(draft);
            if (next && next !== q) navigate(searchHref({ q: next, type, sort }));
          }}
        >
          <label className="flex h-8 min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 transition-colors focus-within:border-accent/60">
            <HugeiconsIcon icon={Search01Icon} className="size-3.5 shrink-0 text-subtle" />
            <input
              ref={searchRef}
              value={draft}
              autoFocus={!q}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (setDraft(q), e.currentTarget.blur())}
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-subtle"
              placeholder="Search GitHub, e.g. react hooks language:typescript"
            />
            {draft === q ? <Kbd>/</Kbd> : <Kbd>↵</Kbd>}
          </label>
          {Object.keys(sorts).length > 1 && (
            <Menu<string>
              value={sort}
              options={Object.entries(sorts).map(([value, label]) => ({ value, label }))}
              onChange={(next) => navigate(searchHref({ q, type, sort: next }))}
              trigger={(open) => (
                <Button onClick={open} icon={<HugeiconsIcon icon={ArrowUpDownIcon} className="size-3.5 text-subtle" />}>
                  {sorts[sort]}
                </Button>
              )}
            />
          )}
        </form>
        {!q ? (
          <Panel className="mt-4">
            <Empty>Search repositories, code, issues, pull requests, people and commits across GitHub.</Empty>
          </Panel>
        ) : type === 'repositories' ? (
          <RepoResults q={q} sort={sort} />
        ) : type === 'users' ? (
          <UserResults q={q} sort={sort} />
        ) : type === 'code' ? (
          <CodeResults q={q} />
        ) : type === 'commits' ? (
          <CommitResults q={q} sort={sort} />
        ) : (
          <WorkResults q={q} type={type} sort={sort} />
        )}
      </div>
    </Shell>
  );
}

type Paging = { error: Error | null; isPending: boolean; hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };

/** A tab's results: loading, error, the total, the rows (in one panel, or as cards), and Load more. */
function Results({ query, total, cards, children }: { query: Paging; total?: number; cards?: boolean; children: ReactNode }) {
  if (query.error) return <p className="py-10 text-[13px] text-danger">{query.error.message}</p>;
  if (query.isPending) {
    return (
      <Panel className="mt-4 flex flex-col gap-3 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </Panel>
    );
  }
  const more = query.hasNextPage && (
    <div className={cards ? 'flex justify-center' : 'flex justify-center border-t border-line p-3'}>
      <Button size="sm" variant="ghost" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
        Load more
      </Button>
    </div>
  );
  return (
    <>
      <div className="mt-4 mb-2 px-1 text-[12.5px] text-muted">
        <span className="font-medium text-fg tabular-nums">{(total ?? 0).toLocaleString()}</span> {total === 1 ? 'result' : 'results'}
      </div>
      {!total ? (
        <Panel className="animate-enter">
          <Empty>Nothing matches.</Empty>
        </Panel>
      ) : cards ? (
        <div className="flex animate-enter flex-col gap-3">
          {children}
          {more}
        </div>
      ) : (
        <Panel className="animate-enter overflow-hidden">
          {children}
          {more}
        </Panel>
      )}
    </>
  );
}

/** Patches one result in a cached search (a star or follow), cancelling a page fetch that would undo it. */
function usePatch<T extends { id: string }>(queryKey: DataTag<QueryKey, InfiniteData<Page<T, string>>, Error>) {
  const client = useQueryClient();
  return async (id: string, changes: Partial<T>) => {
    await client.cancelQueries({ queryKey });
    client.setQueryData(queryKey, (data) =>
      data && { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => (item.id === id ? { ...item, ...changes } : item)) })) },
    );
  };
}

function RepoResults({ q, sort }: { q: string; sort: string }) {
  const options = repoSearchQuery(q, sort);
  const query = useInfiniteQuery(options);
  const patch = usePatch(options.queryKey);
  return (
    <Results query={query} total={query.data?.pages[0]?.total}>
      {query.data?.pages.flatMap((page) => page.items).map((repo) => <RepoRow key={repo.id} repo={repo} fullName topics onChange={(changes) => patch(repo.id, changes)} />)}
    </Results>
  );
}

function UserResults({ q, sort }: { q: string; sort: string }) {
  const options = userSearchQuery(q, sort);
  const query = useInfiniteQuery(options);
  const patch = usePatch(options.queryKey);
  return (
    <Results query={query} total={query.data?.pages[0]?.total}>
      {query.data?.pages
        .flatMap((page) => page.items)
        .map((person) => <PersonRow key={person.id} person={person} showFollowsYou onToggled={(following) => patch(person.id, { viewerIsFollowing: following })} />)}
    </Results>
  );
}

function WorkResults({ q, type, sort }: { q: string; type: 'issues' | 'pullrequests'; sort: string }) {
  const query = useInfiniteQuery(workSearchQuery(q, type, sort));
  const items = query.data?.pages.flatMap((page) => page.results.nodes) ?? [];
  const repo = repoLabelFor(items);
  return (
    <Results query={query} total={query.data?.pages[0]?.results.issueCount}>
      {items.map((item) => (item.__typename === 'PullRequest' ? <WorkRow key={item.id} kind="pr" item={item} repo={repo} /> : <WorkRow key={item.id} kind="issue" item={item} repo={repo} />))}
    </Results>
  );
}

/** Files with their matched fragments. Their links open the file at the indexed commit. */
function CodeResults({ q }: { q: string }) {
  const query = useInfiniteQuery(codeSearchQuery(q));
  return (
    <Results query={query} total={query.data?.pages[0]?.total} cards>
      {query.data?.pages
        .flatMap((page) => page.items)
        .map((file) => (
          <Panel key={file.url} className="overflow-hidden">
            <div className="flex h-10 min-w-0 items-center gap-2 border-b border-line px-4 text-[13px]">
              <Avatar src={file.avatarUrl} size={16} square />
              <a href={`/${file.repo}`} className="shrink-0 text-muted hover:text-fg">
                {file.repo}
              </a>
              <span className="text-subtle">/</span>
              <a href={file.url} data-row className="truncate font-medium hover:underline focus:outline-none focus-visible:underline">
                {file.path}
              </a>
            </div>
            {file.fragments.map((fragment, i) => (
              <pre key={i} className="overflow-x-auto border-b border-line px-4 py-2.5 font-mono text-[12px] leading-relaxed text-fg/90 last:border-b-0">
                <Highlighted match={fragment} />
              </pre>
            ))}
          </Panel>
        ))}
    </Results>
  );
}

function CommitResults({ q, sort }: { q: string; sort: string }) {
  const query = useInfiniteQuery(commitSearchQuery(q, sort));
  return (
    <Results query={query} total={query.data?.pages[0]?.total}>
      {query.data?.pages
        .flatMap((page) => page.items)
        .map((commit) => (
          <a
            key={`${commit.repo}@${commit.sha}`}
            href={commit.url}
            data-row
            className="flex h-10 items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none"
          >
            <HugeiconsIcon icon={GitCommitHorizontalIcon} className="size-4 shrink-0 text-subtle" />
            <span className="w-[220px] shrink-0 truncate text-[12px] text-subtle">{commit.repo}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-fg/95">{commit.headline}</span>
            <span className="shrink-0 font-mono text-[11.5px] text-subtle">{commit.sha.slice(0, 7)}</span>
            <span title={commit.author?.login ?? commit.authorName}>
              <Avatar src={commit.author?.avatarUrl} size={18} />
            </span>
            <span className="w-16 shrink-0 text-right text-[12px] text-subtle">{timeAgo(commit.date)}</span>
          </a>
        ))}
    </Results>
  );
}
