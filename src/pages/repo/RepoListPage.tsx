import { useTitle } from '@/lib/useTitle';
import { WorkList } from '@/pages/work/WorkList';
import { RepoFrame } from './RepoFrame';

/** A repo's issues or pull requests (`/owner/repo/issues`, `/pulls`): the shared list, scoped to the repo. */
export function RepoListPage({ owner, repo, tab }: { owner: string; repo: string; tab: 'issues' | 'pulls' }) {
  useTitle(`${tab === 'issues' ? 'Issues' : 'Pull requests'} · ${owner}/${repo}`);
  return (
    <RepoFrame owner={owner} name={repo} view={tab}>
      <WorkList repo={`${owner}/${repo}`} fallback={tab === 'issues' ? 'is:open is:issue' : 'is:open is:pr'} />
    </RepoFrame>
  );
}
