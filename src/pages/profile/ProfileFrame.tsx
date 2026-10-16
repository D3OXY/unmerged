import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Award01Icon, Book02Icon, BookOpen01Icon, StarIcon, UserGroupIcon, UserIcon } from '@hugeicons/core-free-icons';
import { achievementsQuery } from '@/github/achievements';
import { Shell, PageHeader } from '@/app/Shell';
import type { ProfileTab } from '@/lib/routes';
import { useTitle } from '@/lib/useTitle';
import { Avatar, Skeleton } from '@/ui/primitives';
import { Tab, TabBar } from '@/ui/Tabs';
import { profileHeadQuery } from './queries';

const TAB_TITLES: Record<Exclude<ProfileTab, 'overview'>, string> = {
  repositories: 'Repositories',
  achievements: 'Achievements',
  followers: 'Followers',
  following: 'Following',
};

/** Frame for a profile's sub-pages (everything but the overview): who it is, and tabs between views. */
export function ProfileFrame({ login, tab, children }: { login: string; tab: keyof typeof TAB_TITLES; children: ReactNode }) {
  const { data: user } = useQuery(profileHeadQuery(login));
  const achievements = useQuery(achievementsQuery(login));
  const title = TAB_TITLES[tab];
  const base = `/${user?.login ?? login}`;

  useTitle(`${title} · ${user?.login ?? login}`);

  return (
    <Shell active={user?.isViewer ? 'profile' : undefined}>
      <PageHeader crumbs={[{ label: 'People' }, { label: user?.login ?? login, href: base }, { label: title }]} />
      <div className="mx-auto max-w-[1080px] px-6 pb-8">
        <div className="flex items-center gap-3 pt-8 pb-5">
          {user ? <Avatar src={user.avatarUrl} size={40} /> : <Skeleton className="size-10 rounded-full" />}
          <div className="min-w-0">
            <a href={base} className="block truncate text-[18px] font-semibold tracking-tight hover:underline">
              {user?.name ?? user?.login ?? login}
            </a>
            <div className="text-[12.5px] text-muted">@{user?.login ?? login}</div>
          </div>
        </div>

        <TabBar>
          <Tab href={base} icon={<HugeiconsIcon icon={BookOpen01Icon} />} label="Overview" />
          <Tab href={`${base}?tab=repositories`} active={tab === 'repositories'} icon={<HugeiconsIcon icon={Book02Icon} />} label="Repositories" count={user?.repositories.totalCount} />
          <Tab href={`${base}?tab=achievements`} active={tab === 'achievements'} icon={<HugeiconsIcon icon={Award01Icon} />} label="Achievements" count={achievements.data?.length} />
          <Tab href={`${base}?tab=followers`} active={tab === 'followers'} icon={<HugeiconsIcon icon={UserGroupIcon} />} label="Followers" count={user?.followers.totalCount} />
          <Tab href={`${base}?tab=following`} active={tab === 'following'} icon={<HugeiconsIcon icon={UserIcon} />} label="Following" count={user?.following.totalCount} />
          <Tab href={`${base}?tab=stars`} icon={<HugeiconsIcon icon={StarIcon} />} label="Stars" count={user?.starredRepositories.totalCount} />
        </TabBar>

        {children}
      </div>
    </Shell>
  );
}
