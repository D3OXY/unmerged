import type { ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { FileZipIcon, PlusSignIcon, Tag01Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { fullDate, timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { RepoFrame, useRepo } from '@/pages/repo/RepoFrame';
import { canPushWith } from '@/pages/repo/query';
import { Button } from '@/ui/Button';
import { Empty, Panel, Skeleton } from '@/ui/primitives';
import { ReleaseCard } from './ReleaseCard';
import { archiveUrl, releaseHref, releasesQuery, tagsQuery, type Tag } from './query';

type Tab = 'releases' | 'tags';

/**
 * A repo's releases (/releases) or tags (/tags), like GitHub's two tabs. Releases show in full, ten at a time;
 * tags as rows with their commit and source archives. New releases are drafted on GitHub's form.
 */
export function ReleasesPage({ owner, repo: name, tab }: { owner: string; repo: string; tab: Tab }) {
  const repo = useRepo(owner, name).data?.repository;
  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  useTitle(`${tab === 'tags' ? 'Tags' : 'Releases'} · ${nwo}`);
  const canPush = canPushWith(repo?.viewerPermission);

  return (
    <RepoFrame owner={owner} name={name} view={tab}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav className="flex items-center gap-1">
          {(['releases', 'tags'] as const).map((t) => (
            <a
              key={t}
              href={`/${nwo}/${t}`}
              className={cx('flex h-8 items-center rounded-lg px-3 text-[13px] transition-colors', t === tab ? 'bg-hover font-medium text-fg' : 'text-muted hover:text-fg')}
            >
              {t === 'tags' ? 'Tags' : 'Releases'}
            </a>
          ))}
        </nav>
        {canPush && !repo?.isArchived && (
          <a href={`/${nwo}/releases/new`} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg hover:brightness-110">
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            Draft a new release
          </a>
        )}
      </div>
      {tab === 'tags' ? <TagList owner={owner} name={name} nwo={nwo} /> : <ReleaseList owner={owner} name={name} nwo={nwo} canPush={canPush} />}
    </RepoFrame>
  );
}

function ReleaseList({ owner, name, nwo, canPush }: { owner: string; name: string; nwo: string; canPush: boolean }) {
  const options = releasesQuery(owner, name);
  const list = useInfiniteQuery(options);
  const releases = list.data?.pages.flatMap((page) => page.nodes) ?? [];

  if (list.error) return <p className="py-10 text-[13px] text-danger">{list.error.message}</p>;
  if (list.isPending) return <CardSkeleton />;
  if (!releases.length) return <Message>There aren't any releases here yet.</Message>;
  return (
    <div className="flex animate-enter flex-col gap-5">
      {releases.map((release, i) => (
        // The newest release opens its assets, as GitHub's does.
        <ReleaseCard key={release.id} release={release} ctx={{ nwo, canPush, queryKey: options.queryKey }} assetsOpen={i === 0} />
      ))}
      <More query={list} />
    </div>
  );
}

// Tag, then (on wide panels) when it was made, its commit, and its source archives.
const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_7rem] @2xl:grid-cols-[minmax(0,1fr)_7rem_5rem_9rem] items-center gap-x-4 px-4';
const WIDE = 'hidden @2xl:flex';

function TagList({ owner, name, nwo }: { owner: string; name: string; nwo: string }) {
  const list = useInfiniteQuery(tagsQuery(owner, name));
  const tags = list.data?.pages.flatMap((page) => page.nodes) ?? [];

  if (list.error) return <p className="py-10 text-[13px] text-danger">{list.error.message}</p>;
  if (list.isPending) return <RowSkeleton />;
  if (!tags.length) return <Message>There aren't any tags here yet.</Message>;
  return (
    <div className="animate-enter">
      <Panel className="@container overflow-hidden">
        {tags.map((tag) => (
          <TagRow key={tag.name} tag={tag} nwo={nwo} />
        ))}
      </Panel>
      <More query={list} />
    </div>
  );
}

/** One tag: its name (to its release, or to the tag's own page), its commit's headline, date, commit and archives. */
function TagRow({ tag, nwo }: { tag: Tag; nwo: string }) {
  return (
    <div className={cx(COLUMNS, 'min-h-14 border-b border-line py-2 text-[12.5px] last:border-b-0')}>
      <span className="min-w-0">
        <a href={releaseHref(nwo, tag.name)} className="flex min-w-0 items-center gap-1.5 font-medium text-fg hover:underline">
          <HugeiconsIcon icon={Tag01Icon} className="size-3.5 shrink-0 text-subtle" />
          <span className="truncate">{tag.name}</span>
        </a>
        {tag.commit && (
          <span data-private="commits" className="mt-0.5 block truncate pl-5 text-[11.5px] text-subtle">
            {tag.commit.messageHeadline}
          </span>
        )}
      </span>
      <span className="text-muted">{tag.date && <time dateTime={tag.date} title={fullDate(tag.date)}>{timeAgo(tag.date)}</time>}</span>
      <span className={WIDE}>
        {tag.commit && (
          <a href={`/${nwo}/commit/${tag.commit.oid}`} className="font-mono text-[11.5px] text-muted hover:text-fg hover:underline">
            {tag.commit.abbreviatedOid}
          </a>
        )}
      </span>
      <span className={cx(WIDE, 'items-center gap-3')}>
        {(['zip', 'tar.gz'] as const).map((type) => (
          <a key={type} href={archiveUrl(nwo, tag.name, type)} className="flex items-center gap-1 text-muted hover:text-fg">
            <HugeiconsIcon icon={FileZipIcon} className="size-3.5 text-subtle" />
            {type}
          </a>
        ))}
      </span>
    </div>
  );
}

function More({ query }: { query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown } }) {
  if (!query.hasNextPage) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Button size="sm" variant="ghost" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
        Load more
      </Button>
    </div>
  );
}

export function Message({ children }: { children: ReactNode }) {
  return (
    <Panel>
      <Empty>{children}</Empty>
    </Panel>
  );
}

export function CardSkeleton() {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="mt-2 h-24 w-full" />
    </Panel>
  );
}

function RowSkeleton() {
  return (
    <Panel className="overflow-hidden">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-4 border-b border-line px-4 last:border-b-0">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </Panel>
  );
}
