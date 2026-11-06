import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, GitBranchIcon, GitPullRequestCreateIcon } from '@hugeicons/core-free-icons';
import { sessionLogin } from '@/lib/session';
import { timeAgo } from '@/lib/time';
import { canPushWith, recentPushesQuery, type Repo } from './query';

/**
 * GitHub's "had recent pushes" banner: the viewer's branches pushed in the last hour with no open pull request,
 * each with Compare & pull request. Only a viewer who can push gets it. Dismissing hides those pushes (per repo,
 * across page loads); later ones show.
 */
export function RecentPushes({ repo }: { repo: Repo }) {
  const [owner, name] = repo.nameWithOwner.split('/') as [string, string];
  const login = sessionLogin();
  const dismissKey = `unmerged:pushes-dismissed:${repo.nameWithOwner.toLowerCase()}`;
  const [dismissedAt, setDismissedAt] = useState(() => Number(localStorage.getItem(dismissKey)));
  const pushes = useQuery({ ...recentPushesQuery(owner, name, login ?? ''), enabled: !!login && !repo.isArchived && canPushWith(repo.viewerPermission) });

  const shown = (pushes.data ?? []).filter((push) => push.name !== repo.defaultBranchRef?.name && Date.parse(push.committedDate) > dismissedAt);
  if (!shown.length) return null;

  const dismiss = () => {
    const now = Date.now();
    localStorage.setItem(dismissKey, String(now));
    setDismissedAt(now);
  };

  return (
    <div className="relative mb-4 rounded-xl border border-warning/30 bg-warning/8 py-1 pr-10 pl-4">
      {shown.map((push) => (
        <div key={push.name} className="flex h-10 items-center gap-2 text-[12.5px]">
          <HugeiconsIcon icon={GitBranchIcon} className="size-3.5 shrink-0 text-subtle" />
          <span className="truncate font-mono text-[12px] font-medium">{push.name}</span>
          <span className="shrink-0 text-muted">had recent pushes {timeAgo(push.committedDate)}</span>
          <a
            href={`/${repo.nameWithOwner}/compare/${push.name}?expand=1`}
            className="ml-auto flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-success px-2.5 text-[12px] font-medium text-white hover:brightness-110"
          >
            <HugeiconsIcon icon={GitPullRequestCreateIcon} className="size-3.5" />
            Compare & pull request
          </a>
        </div>
      ))}
      <button type="button" onClick={dismiss} title="Dismiss" className="absolute top-2.5 right-2 flex size-6 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg">
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
      </button>
    </div>
  );
}
