import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Building2, MapPin, UserRound, Users } from 'lucide-react';
import { gql } from '@/github/client';
import { Shell, PageHeader } from '@/app/Shell';
import { rememberOrgs } from '@/lib/orgs';
import type { ProfileTab } from '@/lib/routes';
import { formatCount } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Empty, Panel, Pill, Skeleton } from '@/ui/primitives';
import { Tab, TabBar } from '@/ui/Tabs';
import { FollowButton } from './FollowButton';

const PAGE = /* GraphQL */ `{
  pageInfo { hasNextPage endCursor }
  nodes {
    id login name avatarUrl bio company location
    isViewer viewerIsFollowing viewerCanFollow isFollowingViewer
    followers { totalCount }
  }
}`;

// Followers and following are different connection types, so each gets its own (mutually exclusive) field.
const FOLLOWS_QUERY = /* GraphQL */ `
  query Follows($login: String!, $followers: Boolean!, $after: String) {
    user(login: $login) {
      login name avatarUrl
      followers { totalCount }
      following { totalCount }
      followerList: followers(first: 50, after: $after) @include(if: $followers) ${PAGE}
      followingList: following(first: 50, after: $after) @skip(if: $followers) ${PAGE}
    }
  }
`;

type Person = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  isViewer: boolean;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  isFollowingViewer: boolean;
  followers: { totalCount: number };
};

type PeoplePage = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Person[] };

type Follows = {
  login: string;
  name: string | null;
  avatarUrl: string;
  followers: { totalCount: number };
  following: { totalCount: number };
  followerList?: PeoplePage;
  followingList?: PeoplePage;
};

/** A user's followers or the people they follow, 50 at a time. */
export function FollowsPage({ login, tab }: { login: string; tab: Exclude<ProfileTab, 'overview'> }) {
  const queryClient = useQueryClient();
  const queryKey = ['follows', login.toLowerCase(), tab];
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const { user } = await gql<{ user: Follows | null }>(FOLLOWS_QUERY, { login, followers: tab === 'followers', after: pageParam }, true);
      if (!user) {
        // An organization: GitHub's page has these tabs for orgs too, so hand the URL back.
        rememberOrgs([login]);
        location.reload();
        return null;
      }
      const { followerList, followingList, ...rest } = user;
      // The query asks for exactly one of the two.
      return { ...rest, people: (followerList ?? followingList)! };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last?.people.pageInfo.hasNextPage ? last.people.pageInfo.endCursor : null),
  });

  const user = query.data?.pages[0];
  const people = query.data?.pages.flatMap((page) => page?.people.nodes ?? []) ?? [];
  const title = tab === 'followers' ? 'Followers' : 'Following';

  useTitle(user && `${title} · ${user.login}`);

  // Patch the toggled person in place rather than refetching every loaded page.
  const setFollowing = (id: string, following: boolean) =>
    queryClient.setQueryData<InfiniteData<typeof user>>(queryKey, (data) =>
      data && {
        ...data,
        pages: data.pages.map(
          (page) =>
            page && { ...page, people: { ...page.people, nodes: page.people.nodes.map((p) => (p.id === id ? { ...p, viewerIsFollowing: following } : p)) } },
        ),
      },
    );

  return (
    <Shell>
      <PageHeader crumbs={[{ label: 'People' }, { label: user?.login ?? login, href: `/${login}` }, { label: title }]} />
      <div className="mx-auto max-w-[880px] px-6 pb-20">
        <div className="flex items-center gap-3 pt-8 pb-5">
          {user ? <Avatar src={user.avatarUrl} size={40} /> : <Skeleton className="size-10 rounded-full" />}
          <div className="min-w-0">
            <a href={`/${login}`} className="block truncate text-[18px] font-semibold tracking-tight hover:underline">
              {user?.name ?? user?.login ?? login}
            </a>
            <div className="text-[12.5px] text-muted">@{user?.login ?? login}</div>
          </div>
        </div>

        <TabBar>
          <Tab href={`/${login}?tab=followers`} active={tab === 'followers'} icon={<Users />} label="Followers" count={user?.followers.totalCount} />
          <Tab href={`/${login}?tab=following`} active={tab === 'following'} icon={<UserRound />} label="Following" count={user?.following.totalCount} />
        </TabBar>

        {query.error ? (
          <p className="py-10 text-danger">{query.error.message}</p>
        ) : query.isPending ? (
          <div className="mt-6 flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <Panel className="mt-6 animate-enter overflow-hidden">
            {people.length === 0 && <Empty>{tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</Empty>}
            {people.map((person) => (
              <PersonRow key={person.id} person={person} onToggled={(following) => setFollowing(person.id, following)} />
            ))}
            {query.hasNextPage && (
              <div className="flex justify-center border-t border-line p-3">
                <Button size="sm" variant="ghost" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                  Load more
                </Button>
              </div>
            )}
          </Panel>
        )}
      </div>
    </Shell>
  );
}

function PersonRow({ person, onToggled }: { person: Person; onToggled: (following: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
      <a href={`/${person.login}`} data-row className="flex min-w-0 flex-1 items-start gap-3 rounded-lg focus:outline-none focus-visible:bg-hover">
        <Avatar src={person.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {person.name && <span className="truncate text-[13.5px] font-medium">{person.name}</span>}
            <span className={person.name ? 'text-[12.5px] text-muted' : 'text-[13.5px] font-medium'}>{person.login}</span>
            {person.isFollowingViewer && <Pill>Follows you</Pill>}
          </div>
          {person.bio && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{person.bio}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-subtle [&_svg]:size-3">
            {person.company && (
              <span className="flex items-center gap-1">
                <Building2 />
                {person.company}
              </span>
            )}
            {person.location && (
              <span className="flex items-center gap-1">
                <MapPin />
                {person.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users />
              {formatCount(person.followers.totalCount)} follower{person.followers.totalCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </a>
      {person.viewerCanFollow && !person.isViewer && <FollowButton user={person} onToggled={onToggled} />}
    </div>
  );
}
