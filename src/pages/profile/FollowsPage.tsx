import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Building03Icon, Location01Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { sessionLogin } from '@/lib/session';
import { formatCount } from '@/lib/time';
import { Button } from '@/ui/Button';
import { Avatar, Empty, Panel, Pill, Skeleton } from '@/ui/primitives';
import { FollowButton } from './FollowButton';
import { ProfileFrame } from './ProfileFrame';
import { followsQuery, type Person } from './queries';

/** A user's followers or the people they follow, 50 at a time. */
export function FollowsPage({ login, tab }: { login: string; tab: 'followers' | 'following' }) {
  const queryClient = useQueryClient();
  const options = followsQuery(login, tab);
  const query = useInfiniteQuery(options);

  const people = query.data?.pages.flatMap((page) => page?.people.nodes ?? []) ?? [];
  // On your own followers list, everyone follows you.
  const showFollowsYou = !(tab === 'followers' && login.toLowerCase() === sessionLogin()?.toLowerCase());

  // Patch the toggled person in place rather than refetching every loaded page.
  const setFollowing = (id: string, following: boolean) =>
    queryClient.setQueryData(options.queryKey, (data) =>
      data && {
        ...data,
        pages: data.pages.map(
          (page) =>
            page && { ...page, people: { ...page.people, nodes: page.people.nodes.map((p) => (p.id === id ? { ...p, viewerIsFollowing: following } : p)) } },
        ),
      },
    );

  return (
    <ProfileFrame login={login} tab={tab}>
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
            <PersonRow key={person.id} person={person} showFollowsYou={showFollowsYou} onToggled={(following) => setFollowing(person.id, following)} />
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
    </ProfileFrame>
  );
}

function PersonRow({ person, showFollowsYou, onToggled }: { person: Person; showFollowsYou: boolean; onToggled: (following: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
      <a href={`/${person.login}`} data-row className="flex min-w-0 flex-1 items-start gap-3 rounded-lg focus:outline-none focus-visible:bg-hover">
        <Avatar src={person.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {person.name && <span className="truncate text-[13.5px] font-medium">{person.name}</span>}
            <span className={person.name ? 'text-[12.5px] text-muted' : 'text-[13.5px] font-medium'}>{person.login}</span>
            {showFollowsYou && person.isFollowingViewer && <Pill>Follows you</Pill>}
          </div>
          {person.bio && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{person.bio}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-subtle [&_svg]:size-3">
            {person.company && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Building03Icon} />
                {person.company}
              </span>
            )}
            {person.location && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Location01Icon} />
                {person.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={UserGroupIcon} />
              {formatCount(person.followers.totalCount)} follower{person.followers.totalCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </a>
      {person.viewerCanFollow && !person.isViewer && <FollowButton user={person} onToggled={onToggled} />}
    </div>
  );
}
