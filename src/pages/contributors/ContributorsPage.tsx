import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { cx } from '@/lib/cx';
import { formatCount } from '@/lib/time';
import { useTitle } from '@/lib/useTitle';
import { StatsPending } from '@/pages/repo/pulse';
import { RepoFrame, useRepo } from '@/pages/repo/RepoFrame';
import { Button } from '@/ui/Button';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Avatar, Skeleton } from '@/ui/primitives';
import { contributorsIn, contributorsQuery, type Activity, type ContributorRow, type Metric } from './query';

type Period = 'all' | '1' | '3' | '6' | '12' | '24';

const PERIODS: MenuOption<Period>[] = [
  { value: 'all', label: 'All time' },
  { value: '1', label: 'Last month' },
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: '24', label: 'Last 24 months' },
];

const METRICS: MenuOption<Metric>[] = [
  { value: 'commits', label: 'Commits' },
  { value: 'additions', label: 'Additions' },
  { value: 'deletions', label: 'Deletions' },
];

const COLORS: Record<Metric, string> = { commits: 'var(--u-accent)', additions: 'var(--u-green)', deletions: 'var(--u-red)' };

const day = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/**
 * A repo's contributors like GitHub's /graphs/contributors: everyone's weekly activity over a period, then each
 * author's, ranked by commits, additions or deletions. GitHub only shows it for private repos on paid plans; its
 * API answers for any repo the token can read, so here it works for all of them.
 */
export function ContributorsPage({ owner, repo: name }: { owner: string; repo: string }) {
  const repo = useRepo(owner, name).data?.repository;
  const nwo = repo?.nameWithOwner ?? `${owner}/${name}`;
  useTitle(`Contributors · ${nwo}`);

  const stats = useQuery(contributorsQuery(owner, name));
  const [period, setPeriod] = useState<Period>('all');
  const [chosen, setMetric] = useState<Metric>('commits');
  const hasLines = !!stats.data?.hasLines;
  // Without line counts, only commits can be ranked.
  const metric = hasLines ? chosen : 'commits';
  const view = useMemo(() => stats.data && contributorsIn(stats.data, period === 'all' ? null : Number(period), metric), [stats.data, period, metric]);
  // One scale for every author, so their charts compare.
  const authorMax = useMemo(() => Math.max(0, ...(view?.rows.map((row) => Math.max(...row.weekly[metric])) ?? [])), [view, metric]);
  const branch = repo?.defaultBranchRef?.name;

  return (
    <RepoFrame owner={owner} name={name} view="contributors">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-[15px] font-semibold">Contributors</h2>
          <p className="mt-0.5 text-[12.5px] text-subtle">
            {view?.weeks.length ? `${day.format(view.weeks[0])} – ${day.format(view.weeks.at(-1))} · ` : ''}
            Commits to {branch ? <span className="font-mono text-[12px]">{branch}</span> : 'the default branch'}, excluding merge commits
          </p>
        </div>
        <Picker label="Period" value={period} options={PERIODS} onChange={setPeriod} />
        {hasLines && <Picker label="Contributions" value={metric} options={METRICS} onChange={setMetric} />}
      </div>

      {stats.error ? (
        <div className="mt-6 rounded-xl border border-line bg-panel px-4 py-10 text-center text-[13px]">
          <p className="text-muted">{stats.error instanceof StatsPending ? 'GitHub is still counting this repository’s contributions.' : stats.error.message}</p>
          <Button className="mt-4" onClick={() => stats.refetch()}>
            Try again
          </Button>
        </div>
      ) : !view ? (
        <Loading />
      ) : !view.rows.length ? (
        <p className="mt-6 rounded-xl border border-line bg-panel px-4 py-10 text-center text-[13px] text-subtle">
          {stats.data?.weeks.length ? 'No commits in this period.' : 'No commits yet.'}
        </p>
      ) : (
        <>
          <Overview weeks={view.weeks} activity={view.everyone} metric={metric} hasLines={hasLines} />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {view.rows.map((row, i) => (
              <ContributorCard key={row.login} rank={i + 1} row={row} weeks={view.weeks} metric={metric} hasLines={hasLines} max={authorMax} />
            ))}
          </div>
          {stats.data?.authors.length === 100 && <p className="mt-4 text-center text-[12px] text-subtle">GitHub counts the 100 authors with the most commits.</p>}
        </>
      )}
    </RepoFrame>
  );
}

function Picker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: MenuOption<T>[]; onChange: (value: T) => void }) {
  return (
    <Menu<T>
      value={value}
      options={options}
      onChange={onChange}
      trigger={(open) => (
        <Button onClick={open}>
          <span className="font-normal text-muted">{label}:</span>
          {options.find((o) => o.value === value)?.label}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-subtle" />
        </Button>
      )}
    />
  );
}

/** "Week of Mar 3, 2024". */
const weekLabel = (weeks: number[], week: number) => `Week of ${day.format(weeks[week])}`;

/** Everyone's activity in the period: the totals (a week's, when hovered) over one large chart of `metric`. */
function Overview({ weeks, activity, metric, hasLines }: { weeks: number[]; activity: Activity; metric: Metric; hasLines: boolean }) {
  const [week, setWeek] = useState<number | null>(null);
  return (
    <div className="mt-5 rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Figures activity={activity} week={week} hasLines={hasLines} large />
        <span className="ml-auto text-[12px] text-subtle">{week === null ? `${formatCount(weeks.length)} weeks` : weekLabel(weeks, week)}</span>
      </div>
      <WeekArea className="mt-4" height={160} values={activity.weekly[metric]} max={Math.max(...activity.weekly[metric])} color={COLORS[metric]} week={week} onWeek={setWeek} />
      <div className="mt-2 flex justify-between text-[11px] text-subtle tabular-nums">
        <span>{day.format(weeks[0])}</span>
        <span>{day.format(weeks.at(-1))}</span>
      </div>
    </div>
  );
}

/** One author: rank, name, totals (a week's, when hovered) and their weekly `metric` on the shared `max`. */
function ContributorCard({ rank, row, weeks, metric, hasLines, max }: { rank: number; row: ContributorRow; weeks: number[]; metric: Metric; hasLines: boolean; max: number }) {
  const [week, setWeek] = useState<number | null>(null);
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <a href={`/${row.login}`} className="shrink-0">
          <Avatar src={row.avatarUrl} size={32} />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a href={`/${row.login}`} className="truncate text-[13px] font-medium hover:underline">
              {row.login}
            </a>
            <span className="ml-auto shrink-0 text-[11.5px] text-subtle tabular-nums">{week === null ? `#${rank}` : weekLabel(weeks, week)}</span>
          </div>
          <div className="mt-0.5 flex gap-3">
            <Figures activity={row} week={week} hasLines={hasLines} />
          </div>
        </div>
      </div>
      <WeekArea className="mt-3" height={56} values={row.weekly[metric]} max={max} color={COLORS[metric]} week={week} onWeek={setWeek} />
    </div>
  );
}

/** Commits, and lines added and removed when GitHub counts them: the period's, or one week's. */
function Figures({ activity, week, hasLines, large }: { activity: Activity; week: number | null; hasLines: boolean; large?: boolean }) {
  const of = (metric: Metric) => (week === null ? activity.totals[metric] : activity.weekly[metric][week]!);
  const commits = of('commits');
  const figure = (value: string, unit: string | null, color?: string) => (
    <span className={cx('whitespace-nowrap', large ? 'text-[12.5px] text-muted' : 'text-[12px] text-subtle')}>
      <b className={cx('text-fg tabular-nums', large ? 'text-[22px] font-semibold tracking-tight' : 'text-[12px] font-medium')} style={{ color }}>
        {value}
      </b>
      {unit && ` ${unit}`}
    </span>
  );
  return (
    <>
      {figure(commits.toLocaleString(), commits === 1 ? 'commit' : 'commits')}
      {hasLines && figure(`+${formatCount(of('additions'))}`, large ? 'added' : null, COLORS.additions)}
      {hasLines && figure(`−${formatCount(of('deletions'))}`, large ? 'removed' : null, COLORS.deletions)}
    </>
  );
}

/**
 * A weekly series as a filled line from 0 to `max` (shared by charts that compare). The week under the pointer
 * is reported through `onWeek`, and marked.
 */
function WeekArea({
  values,
  max,
  color,
  height,
  week,
  onWeek,
  className,
}: {
  values: number[];
  max: number;
  color: string;
  height: number;
  week: number | null;
  onWeek: (week: number | null) => void;
  className?: string;
}) {
  const n = values.length;
  const x = (i: number) => (n === 1 ? 0.5 : i / (n - 1));
  // A little headroom, so the peak's stroke isn't clipped.
  const y = (value: number) => 1 - (value / Math.max(1, max)) * 0.96;
  const line = values.map((value, i) => `${i ? 'L' : 'M'}${x(i)},${y(value)}`).join('');
  return (
    <div
      className={cx('relative', className)}
      style={{ height }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onWeek(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)))));
      }}
      onMouseLeave={() => onWeek(null)}
    >
      <span className="absolute inset-x-0 bottom-0 h-px bg-line" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <path d={`${line}L${x(n - 1)},1L${x(0)},1Z`} fill={color} fillOpacity={0.14} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {week !== null && (
        <>
          <span className="pointer-events-none absolute inset-y-0 w-px bg-line-strong" style={{ left: `${x(week) * 100}%` }} />
          <span
            className="pointer-events-none absolute size-2 -translate-1/2 rounded-full border-2 border-panel"
            style={{ left: `${x(week) * 100}%`, top: `${y(values[week]!) * 100}%`, background: color }}
          />
        </>
      )}
    </div>
  );
}

/** While GitHub counts, which can take a few seconds on a repo it hasn't counted lately. */
function Loading() {
  return (
    <>
      <div className="mt-5 flex h-[246px] animate-shimmer items-center justify-center rounded-xl bg-elevated text-[12.5px] text-subtle">Counting contributions…</div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[126px] rounded-xl" />
        ))}
      </div>
    </>
  );
}
