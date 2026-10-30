import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, GitCommitHorizontalIcon } from '@hugeicons/core-free-icons';
import { useViewer } from '@/github/viewer';
import { cx } from '@/lib/cx';
import { navigate } from '@/lib/navigation';
import { timeAgo } from '@/lib/time';
import { Menu, type MenuOption } from '@/ui/Menu';
import { prCommitPickerQuery, repoPath, type PrHead } from '../query';
import { commitsIn, rangeFor } from './range';

/**
 * Which commits Files changed shows: all of them, the changes since the viewer's last review (when that commit
 * is still in the branch), one commit, or (Shift-click) a span of commits. Each pick is a URL that GitHub uses
 * too (/files/<range>), so it can be shared.
 * The commits load once the menu first opens, or at once when the page shows a range (for its name).
 */
export function CommitPicker({ pr, range }: { pr: PrHead; range?: string }) {
  const login = useViewer().data?.login;
  const [opened, setOpened] = useState(false);
  const [owner, repo] = repoPath(pr).split('/') as [string, string];
  const picker = useQuery({ ...prCommitPickerQuery(owner, repo, pr, login ?? ''), enabled: !!login && (opened || !!range) });
  const commits = picker.data?.commits ?? [];
  const reviewed = picker.data?.reviewedOid;
  const sinceReview = reviewed && reviewed !== pr.headRefOid ? `${reviewed}..${pr.headRefOid}` : undefined;
  const selected = range ? commitsIn(commits, range) : [];
  const show = (next?: string | null) => navigate(`${pr.url}/files${next ? `/${next}` : ''}${location.search}`);

  const count = (n: number) => `${n} commit${n === 1 ? '' : 's'}`;
  // Offered only when the reviewed commit is among the commits listed. After a rebase it isn't in the branch,
  // and a compare with it would bring in the base branch's changes too.
  const sinceReviewCount = sinceReview ? commitsIn(commits, sinceReview).length : 0;
  const options: MenuOption<string>[] = [
    { value: 'all', label: 'All commits', hint: count(pr.commits.totalCount) },
    ...(sinceReviewCount ? [{ value: 'review', label: 'Changes since your last review', hint: count(sinceReviewCount) }] : []),
    ...commits.map((c) => ({ value: c.oid, label: c.messageHeadline, hint: `${c.abbreviatedOid} · ${timeAgo(c.committedDate)}` })),
  ];
  const value = [...(!range ? ['all'] : range === sinceReview ? ['review'] : []), ...selected.map((i) => commits[i]!.oid)];
  const head = range?.split('..').at(-1)?.slice(0, 7);
  const label = !range
    ? 'All commits'
    : range === sinceReview
      ? 'Since your last review'
      : selected.length > 1
        ? count(selected.length)
        : !range.includes('..') || selected.length === 1
          ? `Commit ${head}`
          : range.split('..').map((sha) => sha.slice(0, 7)).join('..');

  return (
    <Menu<string>
      align="left"
      value={value}
      options={options}
      onChange={(picked, { shiftKey }) => {
        if (picked === 'all') return show();
        if (picked === 'review') return show(sinceReview);
        const i = commits.findIndex((c) => c.oid === picked);
        const span = shiftKey && selected.length > 0;
        show(span ? rangeFor(commits, Math.min(selected[0]!, i), Math.max(selected.at(-1)!, i)) : rangeFor(commits, i, i));
      }}
      header={
        <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] text-subtle">
          {picker.isPending && opened ? 'Loading commits…' : 'Shift-click to pick a span of commits.'}
          {(picker.data?.totalCount ?? 0) > commits.length && ` Only the latest ${commits.length} show.`}
        </p>
      }
      trigger={(open) => (
        <button
          type="button"
          aria-haspopup="menu"
          onClick={() => {
            setOpened(true);
            open();
          }}
          className={cx(
            'flex h-7 max-w-56 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[12px]',
            range ? 'border-accent/40 bg-accent/12 text-fg' : 'border-line text-muted hover:text-fg',
          )}
        >
          <HugeiconsIcon icon={GitCommitHorizontalIcon} className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3 shrink-0" />
        </button>
      )}
    />
  );
}
