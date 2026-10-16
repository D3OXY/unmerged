import { useQuery } from '@tanstack/react-query';
import { CircleDot, GitPullRequest } from 'lucide-react';
import { PageHeader, Shell } from '@/app/Shell';
import type { WorkFilter } from '@/lib/routes';
import { useTitle } from '@/lib/useTitle';
import { Tab, TabBar } from '@/ui/Tabs';
import { defaultQuery, TABS, workTabsQuery, type WorkType } from './queries';
import { WorkList } from './WorkList';

/** Your pull requests or issues (`/pulls`, `/issues/assigned`, …): a tab per filter over the shared list. */
export function WorkListPage({ type, filter }: { type: WorkType; filter: WorkFilter }) {
  const title = type === 'pr' ? 'Pull requests' : 'Issues';
  useTitle(title);

  const tabCounts = useQuery(workTabsQuery(type));

  return (
    <Shell active={type === 'pr' ? 'pulls' : 'issues'}>
      <PageHeader crumbs={[{ label: title }]} />
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <TabBar className="mt-2 mb-5">
          {TABS[type].map((tab, i) => (
            <Tab key={tab.filter} href={tab.path} active={tab.filter === filter} icon={type === 'pr' ? <GitPullRequest /> : <CircleDot />} label={tab.label} count={tabCounts.data?.[i]} />
          ))}
        </TabBar>
        <WorkList fallback={defaultQuery(type, filter)} />
      </div>
    </Shell>
  );
}
