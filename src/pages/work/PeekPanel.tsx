import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowExpand01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/app/Shell';
import { navigate, withPeek } from '@/lib/navigation';
import type { Peek, PrTab } from '@/lib/routes';
import { IssueContent } from '@/pages/issue/IssuePage';
import { issueQuery } from '@/pages/issue/query';
import { PrContent } from '@/pages/pr/PrPage';
import { prQuery } from '@/pages/pr/query';
import { Button } from '@/ui/Button';

const TAB_PATHS: Record<PrTab, string> = { conversation: '', commits: '/commits', checks: '/checks', files: '/files' };

/** The page a peeked pull request or issue opens full screen. */
export const peekPage = (peek: Peek) =>
  peek.kind === 'issue' ? `/${peek.owner}/${peek.repo}/issues/${peek.number}` : `/${peek.owner}/${peek.repo}/pull/${peek.number}${TAB_PATHS[peek.tab]}`;

/**
 * Whether a peeked item's repository is private, from the query its content runs anyway. Unknown (still
 * loading) counts as private, so Privacy blurs until it knows.
 */
export function usePrivatePeek({ kind, owner, repo, number }: Peek) {
  const pr = useQuery({ ...prQuery(owner, repo, number), enabled: kind === 'pr' });
  const issue = useQuery({ ...issueQuery(owner, repo, number), enabled: kind === 'issue' });
  return (kind === 'pr' ? pr.data : issue.data)?.repository?.isPrivate !== false;
}

/**
 * A list's side panel: the pull request or issue in the list's `?peek=`, scrolling on its own, with buttons to
 * open it full screen (its own page) or close it. Below the `lg` breakpoint it covers the list.
 */
export function PeekPanel({ peek }: { peek: Peek }) {
  const { owner, repo, number } = peek;
  const page = peekPage(peek);
  const privateRepo = usePrivatePeek(peek);
  return (
    // Keyed by the page so each one starts at the top, like a navigation.
    <aside
      key={page}
      data-repo-private={privateRepo || undefined}
      aria-label="Side panel"
      className="@container sticky top-0 h-screen min-w-0 flex-1 overflow-y-auto overscroll-contain border-l border-line bg-bg max-lg:fixed max-lg:inset-0 max-lg:z-40"
    >
      <PageHeader
        crumbs={[{ label: <span data-private="repos">{`${owner}/${repo}`}</span>, href: `/${owner}/${repo}` }, { label: `#${number}` }]}
        actions={
          <>
            <Button size="icon" variant="ghost" title="Open full screen" aria-label="Open full screen" icon={<HugeiconsIcon icon={ArrowExpand01Icon} className="size-4" />} onClick={() => navigate(page)} />
            <Button size="icon" variant="ghost" title="Close" aria-label="Close" icon={<HugeiconsIcon icon={Cancel01Icon} className="size-4" />} onClick={() => navigate(withPeek(location.href, null))} />
          </>
        }
      />
      <PeekContent peek={peek} />
    </aside>
  );
}

/** What a side panel (or the issue list's reader) shows for `peek`, without a frame. */
export function PeekContent({ peek }: { peek: Peek }) {
  const { owner, repo, number } = peek;
  return peek.kind === 'issue' ? (
    <div className="px-6 pt-8 pb-8">
      <IssueContent owner={owner} repo={repo} number={number} panel />
    </div>
  ) : (
    <PrContent owner={owner} repo={repo} number={number} tab={peek.tab} panel />
  );
}
