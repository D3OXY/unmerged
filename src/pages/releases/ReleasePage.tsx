import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { FileZipIcon, GitCommitIcon, PlusSignIcon, Tag01Icon } from '@hugeicons/core-free-icons';
import { fullDate, timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { canPushWith } from '@/pages/repo/query';
import { RepoFrame, useRepo } from '@/pages/repo/RepoFrame';
import { Avatar, Panel } from '@/ui/primitives';
import { AssetRow, ReleaseCard } from './ReleaseCard';
import { CardSkeleton, Message } from './ReleasesPage';
import { archiveUrl, releaseHref, releaseQuery, type Tag } from './query';

/**
 * One release (/releases/tag/<tag>) with its assets open, or the latest (/releases/latest), whose URL then
 * becomes its tag's, as GitHub's redirect does. A tag without a release shows the tag.
 */
export function ReleasePage({ owner, repo: name, tag }: { owner: string; repo: string; tag?: string }) {
  const repo = useRepo(owner, name).data?.repository;
  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  const options = releaseQuery(owner, name, tag);
  const query = useQuery(options);
  const release = query.data?.release;
  const label = release?.tagName ?? tag;
  useTitle(`${release?.name || label || 'Latest release'} · Releases · ${nwo}`);
  const canPush = canPushWith(repo?.viewerPermission);

  const latestTag = !tag && release?.tagName;
  useEffect(() => {
    if (latestTag) history.replaceState(history.state, '', releaseHref(nwo, latestTag));
  }, [latestTag, nwo]);

  return (
    <RepoFrame owner={owner} name={name} view="releases" item={label}>
      {query.error ? (
        <p className="py-10 text-[13px] text-danger">{query.error.message}</p>
      ) : query.isPending ? (
        <CardSkeleton />
      ) : release ? (
        <div className="animate-enter">
          <ReleaseCard release={release} ctx={{ nwo, canPush, queryKey: options.queryKey }} assetsOpen />
        </div>
      ) : query.data.tag ? (
        <TagCard tag={query.data.tag} nwo={nwo} canPush={canPush && !repo?.isArchived} />
      ) : (
        <Message>{tag ? `This repository has no release or tag “${tag}”.` : 'This repository has no releases yet.'}</Message>
      )}
    </RepoFrame>
  );
}

/** A tag without a release: its message (or its commit's), who made it and when, its commit and source archives. */
function TagCard({ tag, nwo, canPush }: { tag: Tag; nwo: string; canPush: boolean }) {
  const login = tag.by?.user?.login;
  return (
    <Panel className="animate-enter overflow-hidden">
      <header className="px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-[18px] font-semibold tracking-tight">
            <HugeiconsIcon icon={Tag01Icon} className="size-4 shrink-0 text-subtle" />
            <span className="truncate">{tag.name}</span>
          </h2>
          {canPush && (
            <a
              href={`/${nwo}/releases/new?tag=${encodeURIComponent(tag.name)}`}
              className="ml-auto flex h-7 items-center gap-1.5 rounded-md border border-line bg-elevated px-2.5 text-[12px] font-medium hover:border-line-strong hover:bg-hover"
            >
              <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
              Create release from tag
            </a>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          {tag.by && (
            <span className="flex items-center gap-1.5">
              <Avatar src={tag.by.user?.avatarUrl} size={16} />
              {login ? (
                <a href={`/${login}`} className="font-medium text-fg hover:underline">
                  {login}
                </a>
              ) : (
                <span className="font-medium text-fg">{tag.by.name}</span>
              )}
              {' tagged this '}
              {tag.date && (
                <time dateTime={tag.date} title={fullDate(tag.date)}>
                  {timeAgo(tag.date)}
                </time>
              )}
            </span>
          )}
          {tag.commit && (
            <a href={`/${nwo}/commit/${tag.commit.oid}`} className="flex items-center gap-1 font-mono text-[11.5px] hover:text-fg">
              <HugeiconsIcon icon={GitCommitIcon} className="size-3.5 text-subtle" />
              {tag.commit.abbreviatedOid}
            </a>
          )}
        </div>
      </header>
      <p data-private="commits" className="px-5 py-4 text-[13.5px] whitespace-pre-wrap">
        {tag.message ?? tag.commit?.messageHeadline}
      </p>
      <ul className="border-t border-line px-3 py-2">
        {(['zip', 'tar.gz'] as const).map((type) => (
          <AssetRow key={type} icon={<HugeiconsIcon icon={FileZipIcon} className="size-3.5 shrink-0" />} href={archiveUrl(nwo, tag.name, type)} name={`Source code (${type})`} />
        ))}
      </ul>
    </Panel>
  );
}
