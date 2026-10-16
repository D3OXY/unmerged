import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Plus } from 'lucide-react';
import { gql } from '@/github/client';
import { useViewer } from '@/github/viewer';
import { Shell, PageHeader } from '@/app/Shell';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Empty, Kbd, Panel, SectionHeader, Skeleton } from '@/ui/primitives';
import { PrStateIcon } from '@/ui/status';
import { ISSUE_ROW_FIELDS, PR_ROW_FIELDS, WorkRow, type IssueRowData, type PrRowData } from '@/ui/WorkRow';

const weekAgo = () => new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

const HOME_QUERY = /* GraphQL */ `
  query Home($mergedSince: String!) {
    reviewRequested: search(type: ISSUE, first: 15, query: "is:open is:pr review-requested:@me archived:false sort:updated-desc") {
      issueCount nodes { ...PrRow }
    }
    authored: search(type: ISSUE, first: 15, query: "is:open is:pr author:@me archived:false sort:updated-desc") {
      issueCount nodes { ...PrRow }
    }
    assigned: search(type: ISSUE, first: 15, query: "is:open is:issue assignee:@me archived:false sort:updated-desc") {
      issueCount nodes { ...IssueRow }
    }
    merged: search(type: ISSUE, first: 6, query: "is:pr author:@me is:merged sort:updated-desc") {
      nodes { ...PrRow }
    }
    mergedThisWeek: search(type: ISSUE, first: 0, query: $mergedSince) { issueCount }
  }
  ${PR_ROW_FIELDS}
  ${ISSUE_ROW_FIELDS}
`;

type Search<T> = { issueCount: number; nodes: T[] };
type HomeData = {
  reviewRequested: Search<PrRowData>;
  authored: Search<PrRowData>;
  assigned: Search<IssueRowData>;
  merged: { nodes: PrRowData[] };
  mergedThisWeek: { issueCount: number };
};

function greeting() {
  const hour = new Date().getHours();
  return hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** The dashboard: what needs you, what you're waiting on, and what shipped. */
export function HomePage() {
  const { data: viewer } = useViewer();
  const { data, isPending, error } = useQuery({
    queryKey: ['home'],
    queryFn: () => gql<HomeData>(HOME_QUERY, { mergedSince: `is:pr author:@me is:merged merged:>=${weekAgo()}` }),
    staleTime: 30_000,
  });

  const firstName = viewer?.name?.split(' ')[0] ?? viewer?.login;
  useTitle('GitHub');

  return (
    <Shell active="home">
      <PageHeader
        crumbs={[{ label: 'Home' }]}
        actions={
          <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => location.assign('/new')}>
            New repository
          </Button>
        }
      />
      <div className="mx-auto max-w-[1180px] animate-enter px-6 pt-10 pb-8">
        <h1 className="text-[26px] font-semibold tracking-tight">
          {greeting()}
          {firstName && `, ${firstName}`}
        </h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Needs your review" value={data?.reviewRequested.issueCount} tone="text-warning" />
          <Stat label="Your open PRs" value={data?.authored.issueCount} tone="text-success" />
          <Stat label="Assigned issues" value={data?.assigned.issueCount} tone="text-info" />
          <Stat label="Merged this week" value={data?.mergedThisWeek.issueCount} tone="text-merged" />
        </div>

        {error && <p className="mt-6 text-[13px] text-danger">{error.message}</p>}

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-7">
            <ListSection title="Needs your review" count={data?.reviewRequested.issueCount} loading={isPending} more="/pulls/review-requested">
              {data?.reviewRequested.nodes.map((pr) => <WorkRow key={pr.id} item={pr} kind="pr" />)}
              {data && !data.reviewRequested.nodes.length && <Empty>Inbox zero. Nobody is waiting on you.</Empty>}
            </ListSection>
            <ListSection title="Your pull requests" count={data?.authored.issueCount} loading={isPending} more="/pulls">
              {data?.authored.nodes.map((pr) => <WorkRow key={pr.id} item={pr} kind="pr" />)}
              {data && !data.authored.nodes.length && <Empty>No open pull requests.</Empty>}
            </ListSection>
            <ListSection title="Assigned issues" count={data?.assigned.issueCount} loading={isPending} more="/issues/assigned">
              {data?.assigned.nodes.map((issue) => <WorkRow key={issue.id} item={issue} kind="issue" />)}
              {data && !data.assigned.nodes.length && <Empty>Nothing assigned to you.</Empty>}
            </ListSection>
          </div>

          <aside className="flex flex-col gap-7">
            <div>
              <SectionHeader title="Recently merged" />
              <Panel className="p-1.5">
                {isPending && <RowsSkeleton rows={4} />}
                {data?.merged.nodes.map((pr) => (
                  <a key={pr.id} href={pr.url} data-row className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover focus:bg-hover focus:outline-none">
                    <PrStateIcon state="MERGED" className="mt-0.5 size-3.5" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[12.5px] leading-snug font-medium">{pr.title}</span>
                      <span className="text-[11.5px] text-subtle">
                        {pr.repository.nameWithOwner} · {timeAgo(pr.updatedAt)}
                      </span>
                    </span>
                  </a>
                ))}
                {data && !data.merged.nodes.length && <Empty>Nothing merged yet.</Empty>}
              </Panel>
            </div>
            <div>
              <SectionHeader title="Shortcuts" />
              <Panel className="flex flex-col gap-2.5 p-4 text-[12.5px] text-muted">
                <Shortcut keys={['⌘', 'K']}>Search & commands</Shortcut>
                <Shortcut keys={['J', 'K']}>Move between rows</Shortcut>
                <Shortcut keys={['G', 'H']}>Go home</Shortcut>
                <Shortcut keys={['G', 'P']}>Go to your profile</Shortcut>
              </Panel>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone: string }) {
  return (
    <Panel className="px-4 py-3.5">
      <div className="text-[12px] text-muted">{label}</div>
      {value === undefined ? (
        <Skeleton className="mt-2 h-6 w-10" />
      ) : (
        <div className={`mt-1 text-[24px] font-semibold tracking-tight tabular-nums ${value ? tone : 'text-subtle'}`}>{value}</div>
      )}
    </Panel>
  );
}

function ListSection({ title, count, loading, more, children }: { title: string; count?: number; loading: boolean; more: string; children: ReactNode }) {
  return (
    <section>
      <SectionHeader
        title={title}
        count={count}
        action={
          <a href={more} className="flex items-center gap-1 text-[12px] text-subtle hover:text-fg">
            View all <ArrowUpRight className="size-3" />
          </a>
        }
      />
      <Panel className="overflow-hidden">{loading ? <RowsSkeleton rows={3} /> : children}</Panel>
    </section>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </div>
  );
}

function Shortcut({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      {children}
      <span className="flex gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
    </div>
  );
}
