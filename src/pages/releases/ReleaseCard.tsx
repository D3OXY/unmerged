import { useState, type ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, FileZipIcon, GitCommitIcon, Package01Icon, PencilEdit02Icon, Tag01Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { formatBytes, fullDate, timeAgo } from '@/lib/time';
import { Reactions } from '@/pages/pr/CommentBody';
import { treeUrl } from '@/pages/repo/urls';
import { Avatar, Markdown, Panel, Pill } from '@/ui/primitives';
import { archiveUrl, type Release } from './query';

/** What a release card needs from its page: the repo, whether the viewer may edit releases, and what to refetch after a reaction. */
export type CardContext = { nwo: string; canPush: boolean; queryKey: QueryKey };

/**
 * One release as GitHub draws it: title and labels, who released it and when, its tag and commit, the notes, the
 * assets (open on `assetsOpen`), and reactions. Editing happens on GitHub's form.
 */
export function ReleaseCard({ release, ctx, assetsOpen = false }: { release: Release; ctx: CardContext; assetsOpen?: boolean }) {
  const { nwo, canPush, queryKey } = ctx;
  const at = release.publishedAt ?? release.createdAt;
  const reacted = release.reactionGroups.some((g) => g.reactors.totalCount > 0);
  return (
    <Panel className="overflow-hidden">
      <header className="px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* A draft's page (/releases/tag/untagged-…) is GitHub's. */}
          <a href={release.url} className="min-w-0 truncate text-[18px] font-semibold tracking-tight hover:underline">
            {release.name || release.tagName}
          </a>
          {release.isLatest && <Pill className="border-success/40 text-success">Latest</Pill>}
          {release.isPrerelease && <Pill className="border-warning/40 text-warning">Pre-release</Pill>}
          {release.isDraft && <Pill>Draft</Pill>}
          {canPush && (
            <a
              href={release.url.replace('/releases/tag/', '/releases/edit/')}
              aria-label="Edit release"
              title="Edit release"
              className="ml-auto flex size-7 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
            >
              <HugeiconsIcon icon={PencilEdit02Icon} className="size-3.5" />
            </a>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            <Avatar src={release.author?.avatarUrl} size={16} />
            {release.author ? (
              <a href={`/${release.author.login}`} className="font-medium text-fg hover:underline">
                {release.author.login}
              </a>
            ) : (
              'Someone'
            )}
            {release.isDraft ? ' drafted this ' : ' released this '}
            <time dateTime={at} title={fullDate(at)}>
              {timeAgo(at)}
            </time>
          </span>
          <a href={treeUrl(nwo, release.tagName)} className="flex items-center gap-1 font-mono text-[11.5px] hover:text-fg">
            <HugeiconsIcon icon={Tag01Icon} className="size-3.5 text-subtle" />
            {release.tagName}
          </a>
          {release.tagCommit && (
            <a href={`/${nwo}/commit/${release.tagCommit.oid}`} className="flex items-center gap-1 font-mono text-[11.5px] hover:text-fg">
              <HugeiconsIcon icon={GitCommitIcon} className="size-3.5 text-subtle" />
              {release.tagCommit.abbreviatedOid}
            </a>
          )}
        </div>
      </header>
      <div className="px-5 py-4">
        {release.descriptionHTML ? <Markdown html={release.descriptionHTML} className="text-[13.5px]" /> : <span className="text-[13px] text-subtle italic">No release notes.</span>}
      </div>
      <Assets release={release} nwo={nwo} initiallyOpen={assetsOpen} />
      {(release.viewerCanReact || reacted) && (
        <footer className="flex items-center gap-1 border-t border-line px-5 py-3">
          <Reactions node={release} queryKey={queryKey} />
        </footer>
      )}
    </Panel>
  );
}

/** A release's files, then its tag's source archives (a draft's tag may not exist yet, so it has none). */
function Assets({ release, nwo, initiallyOpen }: { release: Release; nwo: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const { totalCount, nodes } = release.releaseAssets;
  const sources = release.isDraft ? [] : (['zip', 'tar.gz'] as const);
  const count = totalCount + sources.length;
  if (!count) return null;
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="border-t border-line">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 px-5 text-[12.5px] font-medium select-none hover:bg-hover [&::-webkit-details-marker]:hidden">
        <HugeiconsIcon icon={ArrowRight01Icon} className={cx('size-3.5 text-subtle transition-transform', open && 'rotate-90')} />
        Assets
        <span className="rounded-full bg-elevated px-1.5 text-[11px] text-muted tabular-nums">{count}</span>
      </summary>
      {/* Rendered only while open: a list of releases can hold hundreds of assets. */}
      {open && (
        <ul className="px-3 pb-2">
          {nodes.map((asset) => (
            <AssetRow key={asset.id} icon={<HugeiconsIcon icon={Package01Icon} className="size-3.5 shrink-0" />} href={asset.downloadUrl} name={asset.name}>
              <span className="w-20 text-right">{formatBytes(asset.size)}</span>
              <time dateTime={asset.updatedAt} title={fullDate(asset.updatedAt)} className="hidden w-24 text-right sm:block">
                {timeAgo(asset.updatedAt)}
              </time>
            </AssetRow>
          ))}
          {sources.map((type) => (
            <AssetRow key={type} icon={<HugeiconsIcon icon={FileZipIcon} className="size-3.5 shrink-0" />} href={archiveUrl(nwo, release.tagName, type)} name={`Source code (${type})`} />
          ))}
          {totalCount > nodes.length && (
            <li className="px-2 py-1.5 text-[12px] text-subtle">
              Showing {nodes.length} of {totalCount} assets.
            </li>
          )}
        </ul>
      )}
    </details>
  );
}

/** A file to download: an asset or a source archive, with `children` (size, date) on its right. */
export function AssetRow({ icon, href, name, children }: { icon: ReactNode; href: string; name: string; children?: ReactNode }) {
  return (
    <li className="flex h-9 items-center gap-2 rounded-lg px-2 text-[12px] text-subtle tabular-nums hover:bg-hover">
      {icon}
      <a href={href} className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-accent hover:underline">
        {name}
      </a>
      {children}
    </li>
  );
}
