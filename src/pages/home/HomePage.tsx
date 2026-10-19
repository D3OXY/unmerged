import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { useViewer } from '@/github/viewer';
import { Shell, PageHeader } from '@/app/Shell';
import { timeAgo } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { Button } from '@/ui/Button';
import { Empty, Kbd, Panel, SectionHeader, Skeleton } from '@/ui/primitives';
import { PrStateIcon } from '@/ui/status';
import { repoLabelFor, WorkRow, type PrRowData } from '@/ui/WorkRow';
import { homeQueries, standing, STANDINGS } from './queries';

function greeting() {
  const hour = new Date().getHours();
  return hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** The dashboard: what needs you, what you're waiting on, and what shipped. */
export function HomePage() {
  const { data: viewer } = useViewer();
  const review = useQuery(homeQueries.reviewRequested());
  const authored = useQuery(homeQueries.authored());
  const assigned = useQuery(homeQueries.assigned());
  const merged = useQuery(homeQueries.merged());
  const { data: mergedThisWeek } = useQuery(homeQueries.mergedThisWeek());
  const error = review.error ?? authored.error ?? assigned.error ?? merged.error;
  const reviewRepo = repoLabelFor(review.data?.nodes ?? []);
  const assignedRepo = repoLabelFor(assigned.data?.nodes ?? []);

  const firstName = viewer?.name?.split(' ')[0] ?? viewer?.login;
  useTitle('GitHub');

  return (
    <Shell active="home">
      <PageHeader
        crumbs={[{ label: 'Home' }]}
        actions={
          <Button size="sm" icon={<HugeiconsIcon icon={Add01Icon} className="size-3.5" />} onClick={() => location.assign('/new')}>
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
          <Stat label="Needs your review" value={review.data?.issueCount} tone="text-warning" />
          <Stat label="Your open PRs" value={authored.data?.issueCount} tone="text-success" />
          <Stat label="Assigned issues" value={assigned.data?.issueCount} tone="text-info" />
          <Stat label="Merged this week" value={mergedThisWeek} tone="text-merged" />
        </div>

        {error && <p className="mt-6 text-[13px] text-danger">{error.message}</p>}

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-7">
            <ListSection title="Needs your review" count={review.data?.issueCount} loading={review.isPending} more="/pulls/review-requested">
              {review.data?.nodes.map((pr) => <WorkRow key={pr.id} item={pr} details={pr} kind="pr" repo={reviewRepo} />)}
              {review.data && !review.data.nodes.length && <Empty>Inbox zero. Nobody is waiting on you.</Empty>}
            </ListSection>
            <ListSection title="Your pull requests" count={authored.data?.issueCount} loading={authored.isPending} more="/pulls">
              {authored.data && <AuthoredGroups prs={authored.data.nodes} />}
              {authored.data && !authored.data.nodes.length && <Empty>No open pull requests.</Empty>}
            </ListSection>
            <ListSection title="Assigned issues" count={assigned.data?.issueCount} loading={assigned.isPending} more="/issues/assigned">
              {assigned.data?.nodes.map((issue) => <WorkRow key={issue.id} item={issue} details={issue} kind="issue" repo={assignedRepo} />)}
              {assigned.data && !assigned.data.nodes.length && <Empty>Nothing assigned to you.</Empty>}
            </ListSection>
          </div>

          <aside className="flex flex-col gap-7">
            <div>
              <SectionHeader title="Recently merged" />
              <Panel className="p-1.5">
                {merged.isPending && <RowsSkeleton rows={4} />}
                {merged.data?.nodes
                  .toSorted((a, b) => b.mergedAt.localeCompare(a.mergedAt))
                  .slice(0, 6)
                  .map((pr) => (
                    <a
                      key={pr.id}
                      href={pr.url}
                      data-row
                      data-repo-private={pr.repository.isPrivate !== false || undefined}
                      className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover focus:bg-hover focus:outline-none"
                    >
                      <PrStateIcon state="MERGED" className="mt-0.5 size-3.5" />
                      <span className="min-w-0">
                        <span data-private="titles" className="line-clamp-2 text-[12.5px] leading-snug font-medium">
                          {pr.title}
                        </span>
                        <span className="text-[11.5px] text-subtle">
                          <span data-private="repos">{pr.repository.nameWithOwner}</span> · {timeAgo(pr.mergedAt)}
                        </span>
                      </span>
                    </a>
                  ))}
                {merged.data && !merged.data.nodes.length && <Empty>Nothing merged yet.</Empty>}
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

/** Your open PRs, grouped by what they need next; empty groups are left out. */
function AuthoredGroups({ prs }: { prs: PrRowData[] }) {
  const repo = repoLabelFor(prs);
  return STANDINGS.map(({ key, title }) => {
    const group = prs.filter((pr) => standing(pr) === key);
    return (
      group.length > 0 && (
        <div key={key} className="border-b border-line last:border-b-0">
          <div className="flex gap-2 border-b border-line px-4 py-1.5 text-[11.5px] font-medium text-subtle">
            {title}
            <span className="tabular-nums">{group.length}</span>
          </div>
          {group.map((pr) => (
            <WorkRow key={pr.id} item={pr} details={pr} kind="pr" repo={repo} />
          ))}
        </div>
      )
    );
  });
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
            View all <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
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
