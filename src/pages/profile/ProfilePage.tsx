import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Building2, CalendarDays, GitFork, Link2, Lock, MapPin, Search, Star, UserPlus, UserCheck } from 'lucide-react';
import { gql, restHtml } from '@/github/client';
import { absolutizeReadme } from '@/github/readme';
import { REPO_CARD_FIELDS, type RepoCard } from '@/github/types';
import { Shell, PageHeader } from '@/app/Shell';
import { rememberOrgs } from '@/lib/orgs';
import { cx } from '@/lib/cx';
import { formatCount, formatMonthYear, timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Empty, LanguageDot, Markdown, Panel, Pill, SectionHeader, Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import { PrStateIcon } from '@/ui/status';
import { PR_ROW_FIELDS, type PrRowData } from '@/ui/WorkRow';
import { ContributionGraph, type ContributionWeek } from './ContributionGraph';

const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!) {
    user(login: $login) {
      id login name avatarUrl bio company location websiteUrl twitterUsername pronouns createdAt
      status { emojiHTML message }
      followers { totalCount }
      following { totalCount }
      starredRepositories { totalCount }
      isViewer viewerIsFollowing viewerCanFollow
      organizations(first: 12) { nodes { login avatarUrl } }
      pinnedItems(first: 6, types: [REPOSITORY]) { nodes { ... on Repository { ...RepoCard } } }
      repositories(first: 20, ownerAffiliations: OWNER, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount nodes { ...RepoCard }
      }
      pullRequests(first: 6, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ...PrRow } }
      contributionsCollection {
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
      }
    }
  }
  ${REPO_CARD_FIELDS}
  ${PR_ROW_FIELDS}
`;

type Profile = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  websiteUrl: string | null;
  twitterUsername: string | null;
  pronouns: string | null;
  createdAt: string;
  status: { emojiHTML: string | null; message: string | null } | null;
  followers: { totalCount: number };
  following: { totalCount: number };
  starredRepositories: { totalCount: number };
  isViewer: boolean;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  organizations: { nodes: { login: string; avatarUrl: string }[] };
  pinnedItems: { nodes: RepoCard[] };
  repositories: { totalCount: number; nodes: RepoCard[] };
  pullRequests: { nodes: PrRowData[] };
  contributionsCollection: { contributionCalendar: { totalContributions: number; weeks: ContributionWeek[] } };
};

const FOLLOW = /* GraphQL */ `mutation Follow($id: ID!) { followUser(input: { userId: $id }) { clientMutationId } }`;
const UNFOLLOW = /* GraphQL */ `mutation Unfollow($id: ID!) { unfollowUser(input: { userId: $id }) { clientMutationId } }`;

/** A person's profile: identity, activity, and work, at a glance. Organizations fall back to GitHub. */
export function ProfilePage({ login }: { login: string }) {
  const queryClient = useQueryClient();
  const { data: user, isPending, error } = useQuery({
    queryKey: ['profile', login.toLowerCase()],
    queryFn: async () => {
      const { user } = await gql<{ user: Profile | null }>(PROFILE_QUERY, { login }, true);
      if (!user) {
        // Not a user: an organization (or nothing). Hand the URL back to GitHub for good.
        rememberOrgs([login]);
        location.reload();
      }
      return user;
    },
  });

  useTitle(user ? (user.name ? `${user.login} (${user.name})` : user.login) : undefined);

  const readme = useQuery({
    queryKey: ['readme', login.toLowerCase()],
    queryFn: async () => {
      const html = await restHtml(`/repos/${login}/${login}/readme`);
      const repoUrl = `https://github.com/${login}/${login}`;
      return html && absolutizeReadme(html, `${repoUrl}/raw/HEAD/`, `${repoUrl}/blob/HEAD/`);
    },
    staleTime: 10 * 60_000,
  });

  const follow = useMutation({
    mutationFn: (user: Profile) => gql(user.viewerIsFollowing ? UNFOLLOW : FOLLOW, { id: user.id }),
    onSuccess: (_, user) => {
      queryClient.setQueryData<Profile>(['profile', login.toLowerCase()], {
        ...user,
        viewerIsFollowing: !user.viewerIsFollowing,
        followers: { totalCount: user.followers.totalCount + (user.viewerIsFollowing ? -1 : 1) },
      });
    },
    onError: toast.error,
  });

  if (error) {
    return (
      <Shell>
        <PageHeader crumbs={[{ label: login }]} />
        <p className="p-10 text-danger">{error.message}</p>
      </Shell>
    );
  }

  return (
    <Shell active={user?.isViewer ? 'profile' : undefined}>
      <PageHeader
        crumbs={[{ label: 'People' }, { label: user?.login ?? login }]}
        actions={
          user &&
          (user.isViewer ? (
            <Button size="sm" onClick={() => location.assign('/settings/profile')}>
              Edit profile
            </Button>
          ) : (
            user.viewerCanFollow && (
              <Button
                size="sm"
                variant={user.viewerIsFollowing ? 'secondary' : 'primary'}
                loading={follow.isPending}
                icon={user.viewerIsFollowing ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                onClick={() => follow.mutate(user)}
              >
                {user.viewerIsFollowing ? 'Following' : 'Follow'}
              </Button>
            )
          ))
        }
      />
      {isPending || !user ? (
        <ProfileSkeleton />
      ) : (
        <div className="mx-auto max-w-[1180px] animate-enter px-6 pt-10 pb-20">
          <ProfileHeader user={user} />

          <Panel className="mt-8 p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-medium">
                {user.contributionsCollection.contributionCalendar.totalContributions.toLocaleString()} contributions
                <span className="font-normal text-muted"> in the last year</span>
              </h2>
            </div>
            <ContributionGraph weeks={user.contributionsCollection.contributionCalendar.weeks} />
          </Panel>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-8">
              {user.pinnedItems.nodes.length > 0 && (
                <section>
                  <SectionHeader title="Pinned" />
                  <div className="grid gap-3 md:grid-cols-2">
                    {user.pinnedItems.nodes.map((repo) => (
                      <RepoTile key={repo.id} repo={repo} />
                    ))}
                  </div>
                </section>
              )}

              {readme.data && (
                <section>
                  <SectionHeader title={`${user.login}/README.md`} />
                  <Panel className="px-6 py-5">
                    <Markdown html={readme.data} />
                  </Panel>
                </section>
              )}

              <RepoList user={user} />
            </div>

            <aside className="flex flex-col gap-8">
              <section>
                <SectionHeader title="Recent pull requests" />
                <Panel className="p-1.5">
                  {user.pullRequests.nodes.length === 0 && <Empty>No pull requests yet.</Empty>}
                  {user.pullRequests.nodes.map((pr) => (
                    <CompactPr key={pr.id} pr={pr} />
                  ))}
                </Panel>
              </section>
              {user.organizations.nodes.length > 0 && (
                <section>
                  <SectionHeader title="Organizations" />
                  <div className="flex flex-wrap gap-2">
                    {user.organizations.nodes.map((org) => (
                      <a key={org.login} href={`/${org.login}`} title={org.login} className="transition-transform hover:scale-105">
                        <Avatar src={org.avatarUrl} size={32} square />
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>
      )}
    </Shell>
  );
}

function ProfileHeader({ user }: { user: Profile }) {
  const website = user.websiteUrl && (user.websiteUrl.startsWith('http') ? user.websiteUrl : `https://${user.websiteUrl}`);
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <Avatar src={user.avatarUrl} size={96} className="ring-4 ring-bg outline outline-line" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[26px] font-semibold tracking-tight">{user.name ?? user.login}</h1>
          {user.status?.message && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 text-[12px] text-muted">
              {user.status.emojiHTML && <span className="text-[12px]" dangerouslySetInnerHTML={{ __html: user.status.emojiHTML }} />}
              {user.status.message}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[14px] text-muted">
          @{user.login}
          {user.pronouns && <span className="text-subtle"> · {user.pronouns}</span>}
        </div>
        {user.bio && <p className="mt-3 max-w-[640px] text-[14px] leading-relaxed text-fg/90">{user.bio}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
          {user.company && <Meta icon={<Building2 />}>{user.company}</Meta>}
          {user.location && <Meta icon={<MapPin />}>{user.location}</Meta>}
          {website && (
            <Meta icon={<Link2 />}>
              <a href={website} target="_blank" rel="noreferrer" className="hover:text-fg">
                {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </Meta>
          )}
          {user.twitterUsername && (
            <Meta icon={<span className="text-[11px] font-semibold">𝕏</span>}>
              <a href={`https://x.com/${user.twitterUsername}`} target="_blank" rel="noreferrer" className="hover:text-fg">
                @{user.twitterUsername}
              </a>
            </Meta>
          )}
          <Meta icon={<CalendarDays />}>Joined {formatMonthYear(user.createdAt)}</Meta>
        </div>
      </div>

      <div className="flex gap-2 md:pt-1">
        <Count href={`/${user.login}?tab=followers`} value={user.followers.totalCount} label="Followers" />
        <Count href={`/${user.login}?tab=following`} value={user.following.totalCount} label="Following" />
        <Count href={`/${user.login}?tab=stars`} value={user.starredRepositories.totalCount} label="Stars" />
      </div>
    </div>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 [&>svg]:size-3.5 [&>svg]:text-subtle">
      {icon}
      {children}
    </span>
  );
}

function Count({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <a href={href} className="min-w-[84px] rounded-xl border border-line bg-panel px-3.5 py-2.5 transition-colors hover:border-line-strong">
      <div className="text-[18px] font-semibold tracking-tight tabular-nums">{formatCount(value)}</div>
      <div className="text-[11.5px] text-muted">{label}</div>
    </a>
  );
}

function RepoTile({ repo }: { repo: RepoCard }) {
  return (
    <a
      href={repo.url}
      data-row
      className="group flex flex-col rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong hover:bg-hover focus:outline-none focus-visible:border-accent/60"
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-[13.5px] font-semibold">{repo.name}</span>
        {repo.isPrivate && <Lock className="size-3 shrink-0 text-subtle" />}
        <ArrowUpRight className="ml-auto size-3.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-snug text-muted">{repo.description ?? 'No description'}</p>
      <RepoMeta repo={repo} className="mt-3" />
    </a>
  );
}

function RepoMeta({ repo, className }: { repo: RepoCard; className?: string }) {
  return (
    <div className={cx('flex items-center gap-4 text-[12px] text-subtle', className)}>
      {repo.primaryLanguage && (
        <span className="flex items-center gap-1.5">
          <LanguageDot color={repo.primaryLanguage.color} />
          {repo.primaryLanguage.name}
        </span>
      )}
      {repo.stargazerCount > 0 && (
        <span className="flex items-center gap-1">
          <Star className="size-3" />
          {formatCount(repo.stargazerCount)}
        </span>
      )}
      {repo.forkCount > 0 && (
        <span className="flex items-center gap-1">
          <GitFork className="size-3" />
          {formatCount(repo.forkCount)}
        </span>
      )}
    </div>
  );
}

function RepoList({ user }: { user: Profile }) {
  const [filter, setFilter] = useState('');
  const repos = useMemo(
    () => user.repositories.nodes.filter((repo) => `${repo.name} ${repo.description ?? ''}`.toLowerCase().includes(filter.toLowerCase())),
    [user.repositories.nodes, filter],
  );

  return (
    <section>
      <SectionHeader
        title="Repositories"
        count={user.repositories.totalCount}
        action={
          <a href={`/${user.login}?tab=repositories`} className="flex items-center gap-1 text-[12px] text-subtle hover:text-fg">
            View all <ArrowUpRight className="size-3" />
          </a>
        }
      />
      <Panel className="overflow-hidden">
        <label className="flex h-10 items-center gap-2 border-b border-line px-4">
          <Search className="size-3.5 text-subtle" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter recently pushed repositories…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle"
          />
        </label>
        {repos.length === 0 && <Empty>No matching repositories.</Empty>}
        {repos.map((repo) => (
          <a
            key={repo.id}
            href={repo.url}
            data-row
            className="flex items-center gap-4 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-hover focus:bg-hover focus:outline-none"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium">{repo.name}</span>
                {repo.isPrivate && <Pill>Private</Pill>}
                {repo.isArchived && <Pill>Archived</Pill>}
              </div>
              {repo.description && <p className="mt-0.5 truncate text-[12.5px] text-muted">{repo.description}</p>}
            </div>
            <RepoMeta repo={repo} className="hidden md:flex" />
            {repo.pushedAt && <span className="w-20 shrink-0 text-right text-[12px] text-subtle">{timeAgo(repo.pushedAt)}</span>}
          </a>
        ))}
      </Panel>
    </section>
  );
}

function CompactPr({ pr }: { pr: PrRowData }) {
  return (
    <a href={pr.url} data-row className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover focus:bg-hover focus:outline-none">
      <PrStateIcon state={pr.state} isDraft={pr.isDraft} className="mt-0.5 size-3.5" />
      <span className="min-w-0">
        <span className="line-clamp-2 text-[12.5px] leading-snug font-medium">{pr.title}</span>
        <span className="text-[11.5px] text-subtle">
          {pr.repository.nameWithOwner}#{pr.number} · {timeAgo(pr.updatedAt)}
        </span>
      </span>
    </a>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] px-6 pt-10">
      <div className="flex gap-6">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-1 flex-col gap-3 pt-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <Skeleton className="mt-8 h-40 rounded-xl" />
    </div>
  );
}
