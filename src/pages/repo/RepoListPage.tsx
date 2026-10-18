import type { Peek } from '@/lib/routes';
import { useTitle } from '@/lib/useTitle';
import { repoListQuery } from '@/pages/work/queries';
import { useIssueSplit } from '@/pages/work/IssueSplit';
import { PeekPanel } from '@/pages/work/PeekPanel';
import { WorkList } from '@/pages/work/WorkList';
import { RecentPushes } from './RecentPushes';
import { RepoFrame, useRepo } from './RepoFrame';

/**
 * A repo's issues or pull requests (`/owner/repo/issues`, `/pulls`): the shared list, scoped to the repo, and
 * the pull request or issue in `peek` in a side panel (unless the issue list has it beside itself). Pull
 * requests also offer to open one for a branch the viewer just pushed.
 */
export function RepoListPage({ owner, repo, tab, peek }: { owner: string; repo: string; tab: 'issues' | 'pulls'; peek?: Peek }) {
  useTitle(`${tab === 'issues' ? 'Issues' : 'Pull requests'} · ${owner}/${repo}`);
  const meta = useRepo(owner, repo).data?.repository;
  const split = useIssueSplit() && tab === 'issues';
  return (
    <RepoFrame owner={owner} name={repo} view={tab} aside={peek && !split && <PeekPanel peek={peek} />}>
      {tab === 'pulls' && meta && <RecentPushes repo={meta} />}
      <WorkList kind={tab === 'issues' ? 'issue' : 'pr'} repo={`${owner}/${repo}`} fallback={repoListQuery(tab)} peek={peek} />
    </RepoFrame>
  );
}
