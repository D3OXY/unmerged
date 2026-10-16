import { useQuery } from '@tanstack/react-query';
import { CircleDot, GitPullRequest } from 'lucide-react';
import { gql } from '@/github/client';
import { PageHeader, Shell } from '@/app/Shell';
import type { WorkFilter } from '@/lib/routes';
import { useTitle } from '@/lib/useTitle';
import { Tab, TabBar } from '@/ui/Tabs';
import { WorkList } from './WorkList';

type WorkType = 'pr' | 'issue';

const TABS: Record<WorkType, { filter: WorkFilter; label: string; path: string }[]> = {
  pr: [
    { filter: 'created', label: 'Created', path: '/pulls' },
    { filter: 'assigned', label: 'Assigned', path: '/pulls/assigned' },
    { filter: 'mentioned', label: 'Mentioned', path: '/pulls/mentioned' },
    { filter: 'review-requested', label: 'Review requests', path: '/pulls/review-requested' },
  ],
  issue: [
    { filter: 'created', label: 'Created', path: '/issues' },
    { filter: 'assigned', label: 'Assigned', path: '/issues/assigned' },
    { filter: 'mentioned', label: 'Mentioned', path: '/issues/mentioned' },
  ],
};

const QUALIFIER: Record<WorkFilter, string> = {
  created: 'author:@me',
  assigned: 'assignee:@me',
  mentioned: 'mentions:@me',
  'review-requested': 'review-requested:@me',
};

/** What GitHub's own page searches for a tab, so plain `/pulls` links mean the same thing here. */
const defaultQuery = (type: WorkType, filter: WorkFilter) => `is:open is:${type} ${QUALIFIER[filter]} archived:false sort:updated-desc`;

/** Your pull requests or issues (`/pulls`, `/issues/assigned`, …): a tab per filter over the shared list. */
export function WorkListPage({ type, filter }: { type: WorkType; filter: WorkFilter }) {
  const title = type === 'pr' ? 'Pull requests' : 'Issues';
  useTitle(title);

  const tabCounts = useQuery({
    queryKey: ['work-tabs', type],
    queryFn: async () => {
      const tabs = TABS[type];
      const fields = tabs.map((tab, i) => `t${i}: search(type: ISSUE, first: 0, query: ${JSON.stringify(defaultQuery(type, tab.filter))}) { issueCount }`);
      const data = await gql<Record<string, { issueCount: number }>>(`query WorkTabs { ${fields.join(' ')} }`);
      return tabs.map((_, i) => data[`t${i}`]?.issueCount ?? 0);
    },
    staleTime: 60_000,
  });

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
