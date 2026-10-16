import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { GitForkIcon, JusticeScale01Icon, Link02Icon, StarIcon, Tag01Icon, ViewIcon } from '@hugeicons/core-free-icons';
import { rest } from '@/github/client';
import { formatCount, timeAgo } from '@/lib/time';
import { Avatar, LanguageDot } from '@/ui/primitives';
import { repoAboutQuery, type Repo } from './query';
import { persisted } from '@/lib/persist';

type Contributor = { login: string; avatar_url: string; contributions: number };

/** About, latest release, languages and top contributors. */
export function RepoSidebar({ repo }: { repo: Repo }) {
  const contributors = useQuery({
    queryKey: ['repo-contributors', repo.nameWithOwner],
    queryFn: () => rest<Contributor[] | undefined>(`/repos/${repo.nameWithOwner}/contributors?per_page=14`),
    staleTime: 10 * 60_000,
    persister: persisted,
  });
  const [owner, name] = repo.nameWithOwner.split('/') as [string, string];
  const { data: about } = useQuery(repoAboutQuery(owner, name));
  const homepage = repo.homepageUrl && (repo.homepageUrl.startsWith('http') ? repo.homepageUrl : `https://${repo.homepageUrl}`);

  return (
    <aside className="flex flex-col gap-7">
      <Section title="About">
        <p className="text-[13px] leading-relaxed text-fg/90">{repo.description ?? <span className="text-subtle italic">No description</span>}</p>
        {homepage && (
          <a href={homepage} target="_blank" rel="noreferrer" className="mt-2.5 flex items-center gap-1.5 truncate text-[12.5px] font-medium text-accent hover:underline">
            <HugeiconsIcon icon={Link02Icon} className="size-3.5 shrink-0" />
            {homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        )}
        {!!about?.repositoryTopics.nodes.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {about.repositoryTopics.nodes.map(({ topic }) => (
              <a key={topic.name} href={`/topics/${topic.name}`} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11.5px] font-medium text-accent hover:bg-accent/20">
                {topic.name}
              </a>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 text-[12.5px] text-muted">
          {about?.licenseInfo && (
            <Stat icon={<HugeiconsIcon icon={JusticeScale01Icon} />}>{about.licenseInfo.spdxId && about.licenseInfo.spdxId !== 'NOASSERTION' ? about.licenseInfo.spdxId : about.licenseInfo.name}</Stat>
          )}
          <Stat icon={<HugeiconsIcon icon={StarIcon} />} href={`/${repo.nameWithOwner}/stargazers`}>
            <b className="font-medium text-fg">{formatCount(repo.stargazerCount)}</b> stars
          </Stat>
          <Stat icon={<HugeiconsIcon icon={ViewIcon} />} href={`/${repo.nameWithOwner}/watchers`}>
            <b className="font-medium text-fg">{formatCount(repo.watchers.totalCount)}</b> watching
          </Stat>
          <Stat icon={<HugeiconsIcon icon={GitForkIcon} />} href={`/${repo.nameWithOwner}/forks`}>
            <b className="font-medium text-fg">{formatCount(repo.forkCount)}</b> forks
          </Stat>
        </div>
      </Section>

      {about?.latestRelease && (
        <Section title="Latest release" action={<a href={`/${repo.nameWithOwner}/releases`}>{about.releases.totalCount} total</a>}>
          <a href={about.latestRelease.url} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3 transition-colors hover:border-line-strong">
            <span className="flex size-8 items-center justify-center rounded-lg bg-success/12 text-success">
              <HugeiconsIcon icon={Tag01Icon} className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{about.latestRelease.name || about.latestRelease.tagName}</span>
              <span className="block text-[11.5px] text-subtle">
                {about.latestRelease.tagName}
                {about.latestRelease.publishedAt && ` · ${timeAgo(about.latestRelease.publishedAt)}`}
              </span>
            </span>
          </a>
        </Section>
      )}

      {!!about?.languages.edges.length && (
        <Section title="Languages">
          <div className="flex h-2 overflow-hidden rounded-full bg-elevated">
            {about.languages.edges.map(({ size, node }) => (
              <span key={node.name} title={node.name} style={{ width: `${(size / about.languages.totalSize) * 100}%`, background: node.color ?? 'var(--u-subtle)' }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {about.languages.edges.map(({ size, node }) => (
              <span key={node.name} className="flex items-center gap-2 text-[12px]">
                <LanguageDot color={node.color} />
                <span className="truncate">{node.name}</span>
                <span className="ml-auto text-subtle tabular-nums">{((size / about.languages.totalSize) * 100).toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {!!contributors.data?.length && (
        <Section title="Contributors" action={<a href={`/${repo.nameWithOwner}/graphs/contributors`}>View all</a>}>
          <div className="flex flex-wrap gap-1.5">
            {contributors.data.map((c) => (
              <a key={c.login} href={`/${c.login}`} title={`${c.login} · ${c.contributions} commits`} className="transition-transform hover:scale-110">
                <Avatar src={c.avatar_url} size={30} />
              </a>
            ))}
          </div>
        </Section>
      )}
    </aside>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between text-[12px]">
        <h2 className="font-medium text-muted">{title}</h2>
        {action && <span className="text-subtle hover:text-fg">{action}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  const body = (
    <>
      <span className="text-subtle [&>svg]:size-3.5">{icon}</span>
      {children}
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-2 hover:text-fg">
      {body}
    </a>
  ) : (
    <span className="flex items-center gap-2">{body}</span>
  );
}
