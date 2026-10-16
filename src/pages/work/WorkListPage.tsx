import { useQueries } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { CircleDotIcon, GitPullRequestIcon } from '@hugeicons/core-free-icons';
import { PageHeader, Shell } from '@/app/Shell';
import type { WorkFilter } from '@/lib/routes';
import { useTitle } from '@/lib/useTitle';
import { Tab, TabBar } from '@/ui/Tabs';
import { defaultQuery, TABS, workTabCountQueries, type WorkType } from './queries';
import { WorkList } from './WorkList';

/** Your pull requests or issues (`/pulls`, `/issues/assigned`, …): a tab per filter over the shared list. */
export function WorkListPage({ type, filter }: { type: WorkType; filter: WorkFilter }) {
  const title = type === 'pr' ? 'Pull requests' : 'Issues';
  useTitle(title);

  const tabCounts = useQueries({ queries: workTabCountQueries(type) });

  return (
    <Shell active={type === 'pr' ? 'pulls' : 'issues'}>
      <PageHeader crumbs={[{ label: title }]} />
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <TabBar className="mt-2 mb-5">
          {TABS[type].map((tab, i) => (
            <Tab key={tab.filter} href={tab.path} active={tab.filter === filter} icon={type === 'pr' ? <HugeiconsIcon icon={GitPullRequestIcon} /> : <HugeiconsIcon icon={CircleDotIcon} />} label={tab.label} count={tabCounts[i]?.data} />
          ))}
        </TabBar>
        <WorkList fallback={defaultQuery(type, filter)} />
      </div>
    </Shell>
  );
}
