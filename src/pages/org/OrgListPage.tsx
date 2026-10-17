import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Book02Icon, BookOpen01Icon, KanbanIcon, PackageIcon, UserGroupIcon, UserMultipleIcon } from '@hugeicons/core-free-icons';
import { Shell, PageHeader } from '@/app/Shell';
import type { OrgTab } from '@/lib/routes';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Empty, Panel, Skeleton } from '@/ui/primitives';
import { Tab, TabBar } from '@/ui/Tabs';
import { PersonRow } from '@/pages/profile/FollowsPage';
import { RepositoryList } from '@/pages/profile/RepositoriesPage';
import { orgPeopleQuery, orgQuery } from './queries';

const TAB_TITLES: Record<OrgTab, string> = { repositories: 'Repositories', people: 'People' };

/**
 * An organization's repositories or people, under its name and tabs. Projects, packages and teams are tabs
 * too, but those pages stay on GitHub.
 */
export function OrgListPage({ login, tab }: { login: string; tab: OrgTab }) {
  const { data: org } = useQuery(orgQuery(login));
  const title = TAB_TITLES[tab];
  const name = org?.login ?? login;

  useTitle(`${title} · ${name}`);

  return (
    <Shell>
      <PageHeader crumbs={[{ label: 'Organizations' }, { label: name, href: `/${name}` }, { label: title }]} />
      <div className="mx-auto max-w-[1080px] px-6 pb-8">
        <div className="flex items-center gap-3 pt-8 pb-5">
          {org ? <Avatar src={org.avatarUrl} size={40} square /> : <Skeleton className="size-10 rounded-md" />}
          <div className="min-w-0">
            <a href={`/${name}`} className="block truncate text-[18px] font-semibold tracking-tight hover:underline">
              {org?.name ?? name}
            </a>
            <div className="text-[12.5px] text-muted">@{name}</div>
          </div>
        </div>

        <TabBar>
          <Tab href={`/${name}`} icon={<HugeiconsIcon icon={BookOpen01Icon} />} label="Overview" />
          <Tab href={`/orgs/${name}/repositories`} active={tab === 'repositories'} icon={<HugeiconsIcon icon={Book02Icon} />} label="Repositories" count={org?.repositories.totalCount} />
          <Tab href={`/orgs/${name}/projects`} icon={<HugeiconsIcon icon={KanbanIcon} />} label="Projects" />
          <Tab href={`/orgs/${name}/packages`} icon={<HugeiconsIcon icon={PackageIcon} />} label="Packages" />
          {org?.viewerIsAMember && <Tab href={`/orgs/${name}/teams`} icon={<HugeiconsIcon icon={UserMultipleIcon} />} label="Teams" />}
          <Tab href={`/orgs/${name}/people`} active={tab === 'people'} icon={<HugeiconsIcon icon={UserGroupIcon} />} label="People" count={org?.membersWithRole.totalCount} />
        </TabBar>

        {tab === 'repositories' ? <RepositoryList login={login} /> : <PeopleList login={login} />}
      </div>
    </Shell>
  );
}

/** Members, 50 at a time, as follower rows. */
function PeopleList({ login }: { login: string }) {
  const queryClient = useQueryClient();
  const options = orgPeopleQuery(login);
  const query = useInfiniteQuery(options);
  const people = query.data?.pages.flatMap((page) => page?.nodes ?? []) ?? [];

  // Patch the toggled person in place rather than refetching every loaded page.
  const setFollowing = (id: string, following: boolean) =>
    queryClient.setQueryData(options.queryKey, (data) =>
      data && { ...data, pages: data.pages.map((page) => page && { ...page, nodes: page.nodes.map((p) => (p.id === id ? { ...p, viewerIsFollowing: following } : p)) }) },
    );

  if (query.error) return <p className="py-10 text-danger">{query.error.message}</p>;
  if (query.isPending) {
    return (
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <Panel className="mt-6 animate-enter overflow-hidden">
      {people.length === 0 && <Empty>No public members.</Empty>}
      {people.map((person) => (
        <PersonRow key={person.id} person={person} showFollowsYou onToggled={(following) => setFollowing(person.id, following)} />
      ))}
      {query.hasNextPage && (
        <div className="flex justify-center border-t border-line p-3">
          <Button size="sm" variant="ghost" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}
    </Panel>
  );
}
