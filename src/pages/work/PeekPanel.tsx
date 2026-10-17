import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowExpand01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/app/Shell';
import { navigate, withPeek } from '@/lib/navigation';
import type { Peek, PrTab } from '@/lib/routes';
import { IssueContent } from '@/pages/issue/IssuePage';
import { PrContent } from '@/pages/pr/PrPage';
import { Button } from '@/ui/Button';

const TAB_PATHS: Record<PrTab, string> = { conversation: '', commits: '/commits', checks: '/checks', files: '/files' };

/**
 * A list's side panel: the pull request or issue in the list's `?peek=`, scrolling on its own, with buttons to
 * open it full screen (its own page) or close it. Below the `lg` breakpoint it covers the list.
 */
export function PeekPanel({ peek }: { peek: Peek }) {
  const { owner, repo, number } = peek;
  const page = peek.kind === 'issue' ? `/${owner}/${repo}/issues/${number}` : `/${owner}/${repo}/pull/${number}${TAB_PATHS[peek.tab]}`;
  return (
    // Keyed by the page so each one starts at the top, like a navigation.
    <aside
      key={page}
      aria-label="Side panel"
      className="@container sticky top-0 h-screen min-w-0 flex-1 overflow-y-auto overscroll-contain border-l border-line bg-bg max-lg:fixed max-lg:inset-0 max-lg:z-40"
    >
      <PageHeader
        crumbs={[{ label: `${owner}/${repo}`, href: `/${owner}/${repo}` }, { label: `#${number}` }]}
        actions={
          <>
            <Button size="icon" variant="ghost" title="Open full screen" aria-label="Open full screen" icon={<HugeiconsIcon icon={ArrowExpand01Icon} className="size-4" />} onClick={() => navigate(page)} />
            <Button size="icon" variant="ghost" title="Close" aria-label="Close" icon={<HugeiconsIcon icon={Cancel01Icon} className="size-4" />} onClick={() => navigate(withPeek(location.href, null))} />
          </>
        }
      />
      {peek.kind === 'issue' ? (
        <div className="px-6 pt-8 pb-8">
          <IssueContent owner={owner} repo={repo} number={number} />
        </div>
      ) : (
        <PrContent owner={owner} repo={repo} number={number} tab={peek.tab} panel />
      )}
    </aside>
  );
}
