import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon, CheckmarkBadge01Icon, FavouriteIcon, Link02Icon, Location01Icon, Mail01Icon } from '@hugeicons/core-free-icons';
import { Shell, PageHeader } from '@/app/Shell';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Avatar, Empty, Markdown, Panel, Pill, SectionHeader, Skeleton } from '@/ui/primitives';
import { Count, Languages, Meta, ProfilePage, ProfileSkeleton, RepoList, RepoTile } from '@/pages/profile/ProfilePage';
import { profileUserQuery } from '@/pages/profile/queries';
import { orgQuery, orgReadmeQuery, orgWorkQuery, type Org } from './queries';

/**
 * `/<login>`: a user's profile or an organization's overview. Which one is only known once `user` comes
 * back (null for an organization); until then the profile's skeleton shows.
 */
export function OwnerPage({ login }: { login: string }) {
  const { data: user } = useQuery(profileUserQuery(login));
  return user === null ? <OrgPage login={login} /> : <ProfilePage login={login} />;
}

/** An organization at a glance: who it is, its README, pinned and recent repositories, and people. */
function OrgPage({ login }: { login: string }) {
  const { data: org, error } = useQuery(orgQuery(login));
  const { data: work } = useQuery(orgWorkQuery(login));
  const readme = useQuery(orgReadmeQuery(login));

  useTitle(org ? (org.name ? `${org.name} · ${org.login}` : org.login) : undefined);

  if (error || org === null) {
    return (
      <Shell>
        <PageHeader crumbs={[{ label: login }]} />
        {error ? <p className="p-10 text-danger">{error.message}</p> : <p className="p-10 text-muted">No user or organization is called {login}.</p>}
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        crumbs={[{ label: 'Organizations' }, { label: org?.login ?? login }]}
        actions={
          org?.hasSponsorsListing && (
            <Button size="sm" icon={<HugeiconsIcon icon={FavouriteIcon} className="size-3.5 text-[#db61a2]" />} onClick={() => location.assign(`/sponsors/${org.login}`)}>
              Sponsor
            </Button>
          )
        }
      />
      {!org ? (
        <ProfileSkeleton />
      ) : (
        <div className="mx-auto max-w-[1180px] animate-enter px-6 pt-10 pb-8">
          <OrgHeader org={org} />

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-8">
              {readme.data && (
                <section>
                  <SectionHeader title={`${readme.data.repo}/profile/README.md`} />
                  <Panel className="px-6 py-5">
                    <Markdown html={readme.data.html} />
                  </Panel>
                </section>
              )}

              {!!work?.pinnedItems.nodes.length && (
                <section>
                  <SectionHeader title="Pinned" />
                  <div className="grid gap-3 md:grid-cols-2">
                    {work.pinnedItems.nodes.map((repo) => (
                      <RepoTile key={repo.id} repo={repo} />
                    ))}
                  </div>
                </section>
              )}

              {work ? <RepoList href={`/orgs/${org.login}/repositories`} repositories={work.repositories} /> : <Skeleton className="h-64 rounded-xl" />}
            </div>

            <aside className="flex flex-col gap-8">
              <People org={org} />
              {work && <Languages repos={work.repositories.nodes} />}
            </aside>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Identity on the left; counts in a card lined up with the right-hand column below, as on a profile. */
function OrgHeader({ org }: { org: Org }) {
  const website = org.websiteUrl && (org.websiteUrl.startsWith('http') ? org.websiteUrl : `https://${org.websiteUrl}`);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar src={org.avatarUrl} size={96} square className="ring-4 ring-bg outline outline-line" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[26px] font-semibold tracking-tight">{org.name ?? org.login}</h1>
            {org.isVerified && (
              <Pill className="border-success/40 text-success">
                <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3" />
                Verified
              </Pill>
            )}
          </div>
          <div className="mt-0.5 text-[14px] text-muted">@{org.login}</div>
          {org.description && <p className="mt-3 max-w-[640px] text-[14px] leading-relaxed text-fg/90">{org.description}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
            {org.location && <Meta icon={<HugeiconsIcon icon={Location01Icon} />}>{org.location}</Meta>}
            {website && (
              <Meta icon={<HugeiconsIcon icon={Link02Icon} />}>
                <a href={website} target="_blank" rel="noreferrer" className="hover:text-fg">
                  {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </Meta>
            )}
            {org.twitterUsername && (
              <Meta icon={<span className="text-[11px] font-semibold">𝕏</span>}>
                <a href={`https://x.com/${org.twitterUsername}`} target="_blank" rel="noreferrer" className="hover:text-fg">
                  @{org.twitterUsername}
                </a>
              </Meta>
            )}
            {org.email && (
              <Meta icon={<HugeiconsIcon icon={Mail01Icon} />}>
                <a href={`mailto:${org.email}`} data-private="emails" className="hover:text-fg">
                  {org.email}
                </a>
              </Meta>
            )}
          </div>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid auto-cols-fr grid-flow-col divide-x divide-line">
          <Count href={`/orgs/${org.login}/repositories`} value={org.repositories.totalCount} label="Repositories" />
          <Count href={`/orgs/${org.login}/people`} value={org.membersWithRole.totalCount} label="People" />
        </div>
      </Panel>
    </div>
  );
}

function People({ org }: { org: Org }) {
  const { totalCount, nodes } = org.membersWithRole;
  return (
    <section>
      <SectionHeader
        title="People"
        count={totalCount}
        action={
          totalCount > 0 && (
            <a href={`/orgs/${org.login}/people`} className="flex items-center gap-1 text-[12px] text-subtle hover:text-fg">
              View all <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
            </a>
          )
        }
      />
      <Panel className="p-4">
        {nodes.length === 0 ? (
          <Empty>No public members.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nodes.map((person) => (
              <a key={person.login} href={`/${person.login}`} title={person.name ? `${person.name} (${person.login})` : person.login} className="transition-transform hover:scale-105">
                <Avatar src={person.avatarUrl} size={32} />
              </a>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}
