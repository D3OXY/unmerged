import { useTitle } from '@/lib/useTitle';
import { repoListQuery } from '@/pages/work/queries';
import { WorkList } from '@/pages/work/WorkList';
import { RecentPushes } from './RecentPushes';
import { RepoFrame, useRepo } from './RepoFrame';

/**
 * A repo's issues or pull requests (`/owner/repo/issues`, `/pulls`): the shared list, scoped to the repo.
 * Pull requests also offer to open one for a branch the viewer just pushed.
 */
export function RepoListPage({ owner, repo, tab }: { owner: string; repo: string; tab: 'issues' | 'pulls' }) {
  useTitle(`${tab === 'issues' ? 'Issues' : 'Pull requests'} · ${owner}/${repo}`);
  const meta = useRepo(owner, repo).data?.repository;
  return (
    <RepoFrame owner={owner} name={repo} view={tab}>
      {tab === 'pulls' && meta && <RecentPushes repo={meta} />}
      <WorkList repo={`${owner}/${repo}`} fallback={repoListQuery(tab)} />
    </RepoFrame>
  );
}
