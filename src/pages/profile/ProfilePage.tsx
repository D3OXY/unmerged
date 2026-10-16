import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, AtSign, Building2, CalendarDays, GitFork, Heart, Link2, Lock, MapPin, Search, Star } from 'lucide-react';
import { useAchievements, type Achievement } from '@/github/achievements';
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
import { PrStateIcon } from '@/ui/status';
import { PR_ROW_FIELDS, type PrRowData } from '@/ui/WorkRow';
import { ContributionGraph, type ContributionWeek } from './ContributionGraph';
import { FollowButton } from './FollowButton';
import { TierLabel } from './TierLabel';

const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!) {
    user(login: $login) {
      id login name avatarUrl bio company location websiteUrl pronouns createdAt
      status { emojiHTML message }
      followers { totalCount }
      following { totalCount }
      starredRepositories { totalCount }
      sponsors { totalCount }
      isViewer viewerIsFollowing viewerCanFollow isFollowingViewer hasSponsorsListing
      isHireable isEmployee isGitHubStar isDeveloperProgramMember isCampusExpert isBountyHunter
      socialAccounts(first: 10) { nodes { provider url displayName } }
      organizations(first: 12) { nodes { login avatarUrl } }
      pinnedItems(first: 6, types: [REPOSITORY]) { nodes { ... on Repository { ...RepoCard } } }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount nodes { ...RepoCard }
      }
      repositoriesContributedTo(first: 12, includeUserRepositories: false, contributionTypes: [COMMIT, PULL_REQUEST, PULL_REQUEST_REVIEW]) {
        nodes { ...RepoCard owner { avatarUrl } }
      }
      pullRequests(first: 6, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ...PrRow } }
      contributionsCollection {
        totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions totalIssueContributions
        restrictedContributionsCount
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
  pronouns: string | null;
  createdAt: string;
  status: { emojiHTML: string | null; message: string | null } | null;
  followers: { totalCount: number };
  following: { totalCount: number };
  starredRepositories: { totalCount: number };
  sponsors: { totalCount: number };
  isViewer: boolean;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  isFollowingViewer: boolean;
  hasSponsorsListing: boolean;
  isHireable: boolean;
  isEmployee: boolean;
  isGitHubStar: boolean;
  isDeveloperProgramMember: boolean;
  isCampusExpert: boolean;
  isBountyHunter: boolean;
  socialAccounts: { nodes: { provider: string; url: string; displayName: string }[] };
  organizations: { nodes: { login: string; avatarUrl: string }[] };
  pinnedItems: { nodes: RepoCard[] };
  repositories: { totalCount: number; nodes: RepoCard[] };
  repositoriesContributedTo: { nodes: (RepoCard & { owner: { avatarUrl: string } })[] };
  pullRequests: { nodes: PrRowData[] };
  contributionsCollection: {
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalIssueContributions: number;
    restrictedContributionsCount: number;
    contributionCalendar: { totalContributions: number; weeks: ContributionWeek[] };
  };
};

// Profile flags worth a badge, in display order.
const BADGES = [
  ['isEmployee', 'Staff'],
  ['isGitHubStar', 'GitHub Star'],
  ['isHireable', 'Available for hire'],
  ['isCampusExpert', 'Campus Expert'],
  ['isBountyHunter', 'Security bug bounty hunter'],
  ['isDeveloperProgramMember', 'Developer Program Member'],
] as const satisfies [keyof Profile, string][];

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

  const setFollowing = (following: boolean) =>
    queryClient.setQueryData<Profile | null>(
      ['profile', login.toLowerCase()],
      (user) => user && { ...user, viewerIsFollowing: following, followers: { totalCount: user.followers.totalCount + (following ? 1 : -1) } },
    );

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
          user && (
            <>
              {user.hasSponsorsListing && !user.isViewer && (
                <Button size="sm" icon={<Heart className="size-3.5 text-[#db61a2]" />} onClick={() => location.assign(`/sponsors/${user.login}`)}>
                  Sponsor
                </Button>
              )}
              {user.isViewer ? (
                <Button size="sm" onClick={() => location.assign('/settings/profile')}>
                  Edit profile
                </Button>
              ) : (
                user.viewerCanFollow && <FollowButton user={user} onToggled={setFollowing} />
              )}
            </>
          )
        }
      />
      {isPending || !user ? (
        <ProfileSkeleton />
      ) : (
        <div className="mx-auto max-w-[1180px] animate-enter px-6 pt-10 pb-8">
          <ProfileHeader user={user} />

          <Contributions user={user} />

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
              <Languages repos={user.repositories.nodes} />
              <section>
                <SectionHeader title="Recent pull requests" />
                <Panel className="p-1.5">
                  {user.pullRequests.nodes.length === 0 && <Empty>No pull requests yet.</Empty>}
                  {user.pullRequests.nodes.map((pr) => (
                    <CompactPr key={pr.id} pr={pr} />
                  ))}
                </Panel>
              </section>
              <ContributedTo repos={user.repositoriesContributedTo.nodes} />
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

/** Identity on the left; counts and achievements in a card lined up with the right-hand column below. */
function ProfileHeader({ user }: { user: Profile }) {
  const website = user.websiteUrl && (user.websiteUrl.startsWith('http') ? user.websiteUrl : `https://${user.websiteUrl}`);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-start">
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
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-muted">
            <span>
              @{user.login}
              {user.pronouns && <span className="text-subtle"> · {user.pronouns}</span>}
            </span>
            {user.isFollowingViewer && <Pill>Follows you</Pill>}
            {BADGES.filter(([flag]) => user[flag]).map(([flag, label]) => (
              <Pill key={flag}>{label}</Pill>
            ))}
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
            {user.socialAccounts.nodes.map((account) => (
              <Meta key={account.url} icon={account.provider === 'TWITTER' ? <span className="text-[11px] font-semibold">𝕏</span> : <AtSign />}>
                <a href={account.url} target="_blank" rel="noreferrer" title={account.provider.toLowerCase()} className="hover:text-fg">
                  {account.displayName}
                </a>
              </Meta>
            ))}
            <Meta icon={<CalendarDays />}>Joined {formatMonthYear(user.createdAt)}</Meta>
          </div>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid auto-cols-fr grid-flow-col divide-x divide-line">
          <Count href={`/${user.login}?tab=followers`} value={user.followers.totalCount} label="Followers" />
          <Count href={`/${user.login}?tab=following`} value={user.following.totalCount} label="Following" />
          <Count href={`/${user.login}?tab=stars`} value={user.starredRepositories.totalCount} label="Stars" />
          {user.hasSponsorsListing && <Count href={`/sponsors/${user.login}`} value={user.sponsors.totalCount} label="Sponsors" />}
        </div>
        <Achievements login={user.login} />
      </Panel>
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
    <a href={href} className="min-w-0 px-3.5 py-3 transition-colors hover:bg-hover">
      <div className="text-[17px] font-semibold tracking-tight tabular-nums">{formatCount(value)}</div>
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
  // The 100 most recently pushed are loaded; the first 20 show until a filter searches all of them.
  const repos = useMemo(
    () =>
      filter
        ? user.repositories.nodes.filter((repo) => `${repo.name} ${repo.description ?? ''}`.toLowerCase().includes(filter.toLowerCase()))
        : user.repositories.nodes.slice(0, 20),
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
            placeholder="Filter repositories…"
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

/** The year's heatmap, with the totals behind it. */
function Contributions({ user }: { user: Profile }) {
  const c = user.contributionsCollection;
  const stats = [
    [c.totalCommitContributions, 'commits'],
    [c.totalPullRequestContributions, 'pull requests'],
    [c.totalPullRequestReviewContributions, 'reviews'],
    [c.totalIssueContributions, 'issues'],
    [c.restrictedContributionsCount, 'private'],
  ] as const;
  return (
    <Panel className="mt-8 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-[13px] font-medium">
          {c.contributionCalendar.totalContributions.toLocaleString()} contributions
          <span className="font-normal text-muted"> in the last year</span>
        </h2>
        <div className="flex flex-wrap gap-x-4 text-[12px] text-subtle">
          {stats
            .filter(([count]) => count > 0)
            .map(([count, label]) => (
              <span key={label}>
                <span className="font-medium text-muted tabular-nums">{count.toLocaleString()}</span> {label}
              </span>
            ))}
        </div>
      </div>
      <ContributionGraph weeks={c.contributionCalendar.weeks} />
    </Panel>
  );
}

/** The header card's lower half. Placeholders while loading; gone entirely when there are none. */
function Achievements({ login }: { login: string }) {
  const { data, isPending } = useAchievements(login);
  if (!isPending && !data?.length) return null;
  return (
    <div className="border-t border-line px-3.5 pt-3 pb-3.5">
      <div className="mb-2.5 flex items-center justify-between text-[12px]">
        <span className="font-medium text-muted">
          Achievements {data && <span className="font-normal text-subtle tabular-nums">{data.length}</span>}
        </span>
        <a href={`/${login}?tab=achievements`} className="flex items-center gap-1 text-subtle hover:text-fg">
          View all <ArrowUpRight className="size-3" />
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        {data
          ? data.map((achievement) => <AchievementBadge key={achievement.slug} login={login} achievement={achievement} />)
          : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="size-12 rounded-full" />)}
      </div>
    </div>
  );
}

function AchievementBadge({ login, achievement: { slug, name, image, tier } }: { login: string; achievement: Achievement }) {
  return (
    <a
      href={`/${login}?achievement=${slug}&tab=achievements`}
      title={tier ? `${name} ${tier.label}` : name}
      className="relative transition-transform hover:scale-105"
    >
      <img src={image} alt={name} className="size-12" />
      {tier && <TierLabel tier={tier} className="absolute -right-1 -bottom-0.5 px-1 text-[9.5px] leading-[14px]" />}
    </a>
  );
}

/** Share of primary languages across the user's own (non-fork) repositories. */
function Languages({ repos }: { repos: RepoCard[] }) {
  const languages = useMemo(() => {
    const counts = new Map<string, { name: string; color: string | null; count: number }>();
    for (const { primaryLanguage: lang } of repos) {
      if (!lang) continue;
      const entry = counts.get(lang.name) ?? { ...lang, count: 0 };
      entry.count++;
      counts.set(lang.name, entry);
    }
    const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, l) => sum + l.count, 0);
    const top = sorted.slice(0, 6);
    const other = sorted.slice(6).reduce((sum, l) => sum + l.count, 0);
    if (other) top.push({ name: 'Other', color: null, count: other });
    return top.map((l) => ({ ...l, share: l.count / total }));
  }, [repos]);

  if (!languages.length) return null;
  return (
    <section>
      <SectionHeader title="Languages" />
      <Panel className="p-4">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {languages.map((l) => (
            <span key={l.name} style={{ flexGrow: l.share, background: l.color ?? 'var(--u-subtle)' }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
          {languages.map((l) => (
            <span key={l.name} className="flex min-w-0 items-center gap-1.5">
              <LanguageDot color={l.color} />
              <span className="truncate">{l.name}</span>
              <span className="ml-auto text-subtle tabular-nums">{Math.round(l.share * 100)}%</span>
            </span>
          ))}
        </div>
      </Panel>
    </section>
  );
}

/** Other people's repositories the user committed to, opened PRs on, or reviewed in the last year. */
function ContributedTo({ repos }: { repos: Profile['repositoriesContributedTo']['nodes'] }) {
  // GitHub ignores ordering on this connection; most-starred first reads best.
  const top = useMemo(() => [...repos].sort((a, b) => b.stargazerCount - a.stargazerCount).slice(0, 6), [repos]);
  if (!top.length) return null;
  return (
    <section>
      <SectionHeader title="Contributed to" />
      <Panel className="p-1.5">
        {top.map((repo) => (
          <a key={repo.id} href={repo.url} data-row className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover focus:bg-hover focus:outline-none">
            <Avatar src={repo.owner.avatarUrl} size={18} square />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{repo.nameWithOwner}</span>
            {repo.stargazerCount > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-subtle">
                <Star className="size-3" />
                {formatCount(repo.stargazerCount)}
              </span>
            )}
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
