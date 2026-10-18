import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CheckState } from '@/github/types';
import { cx } from '@/lib/cx';
import { formatCount, timeAgo } from '@/lib/time';
import { Skeleton } from '@/ui/primitives';
import { PULSE_WEEKS, repoChurnQuery, repoPulseQuery, type Pulse } from './pulse';
import type { Repo } from './query';

const weekDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const PERIOD = `Last ${PULSE_WEEKS} weeks`;

/**
 * The repo root's activity above the files: commits, merged pull requests, issues and lines changed per week,
 * the default branch's CI and the latest release. Each card opens the matching page. Hidden if it fails to load.
 */
export function RepoPulse({ repo }: { repo: Repo }) {
  const [owner, name] = repo.nameWithOwner.split('/') as [string, string];
  const pulse = useQuery(repoPulseQuery(owner, name));
  const churn = useQuery(repoChurnQuery(owner, name));
  if (pulse.isError) return null;
  if (!pulse.data) return <PulseSkeleton />;

  const { weeks, commits, merged, opened, closed, mergeHours, checks, release } = pulse.data;
  const nwo = repo.nameWithOwner;
  const showChurn = churn.data !== null && !churn.isError;
  const hasChecks = checks.some((state) => state !== null);
  const charts = 2 + Number(repo.hasIssuesEnabled) + Number(showChurn);
  const statuses = Number(hasChecks) + Number(!!release);
  return (
    <Grid wide={charts + Math.sign(statuses)}>
      <ChartCard
        title="Commits"
        href={`/${nwo}/commits`}
        weeks={weeks}
        aside={<Trend now={sum(commits)} before={pulse.data.commitsBefore} />}
        up={{ values: commits, color: 'var(--u-accent)' }}
        figure={(i) => <Figure value={pick(commits, i)} unit={pick(commits, i) === 1 ? 'commit' : 'commits'} />}
      />
      <ChartCard
        title="Pull requests"
        href={`/${nwo}/pulls?q=${encodeURIComponent('is:pr is:merged')}`}
        weeks={weeks}
        period={mergeHours === null ? undefined : `${PERIOD} · ~${formatHours(mergeHours)} to merge`}
        aside={<Trend now={sum(merged)} before={pulse.data.mergedBefore} />}
        up={{ values: merged, color: 'var(--u-purple)' }}
        figure={(i) => <Figure value={pick(merged, i)} unit="merged" />}
      />
      {repo.hasIssuesEnabled && (
        <ChartCard
          title="Issues"
          href={`/${nwo}/issues`}
          weeks={weeks}
          aside={<Legend items={[['Opened', 'var(--u-green)'], ['Closed', 'var(--u-purple)']]} />}
          up={{ values: opened, color: 'var(--u-green)' }}
          down={{ values: closed, color: 'var(--u-purple)' }}
          figure={(i) => (
            <>
              <Figure value={pick(opened, i)} unit="opened" />
              <Figure value={pick(closed, i)} unit="closed" />
            </>
          )}
        />
      )}
      {showChurn && (
        <ChartCard
          title="Lines changed"
          href={`/${nwo}/graphs/code-frequency`}
          weeks={weeks}
          up={churn.data ? { values: churn.data.additions, color: 'var(--u-green)' } : undefined}
          down={churn.data ? { values: churn.data.deletions, color: 'var(--u-red)' } : undefined}
          figure={(i) =>
            churn.data ? (
              <>
                <Figure value={pick(churn.data.additions, i)} sign="+" color="var(--u-green)" />
                <Figure value={pick(churn.data.deletions, i)} sign="−" color="var(--u-red)" />
              </>
            ) : (
              <Skeleton className="h-8 w-28" />
            )
          }
        />
      )}
      {hasChecks && <ChecksCard repo={repo} checks={checks} tall={statuses === 1} />}
      {release && <ReleaseCard release={release} tall={statuses === 1} />}
    </Grid>
  );
}

// Whole class names, which Tailwind can see, by how many columns the strip has when wide.
const WIDE_COLUMNS: Record<number, string> = { 2: '@5xl:grid-cols-2', 3: '@5xl:grid-cols-3', 4: '@5xl:grid-cols-4', 5: '@5xl:grid-cols-5' };

/**
 * The cards' grid, sized by the room the page gives it. Wide, it's one row of charts with the status cards
 * stacked in the last column (charts span both rows); narrower, everything flows two or three to a row.
 */
function Grid({ wide, children }: { wide: number; children: ReactNode }) {
  return (
    <div className="@container mb-8">
      <div className={cx('grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3', WIDE_COLUMNS[wide])}>{children}</div>
    </div>
  );
}

type Series = { values: number[]; color: string };

/** A card linking to `href`: the title with `aside` at its right, then the body. `tall` spans both rows when wide. */
function Card({ href, title, aside, tall, children }: { href: string; title: ReactNode; aside?: ReactNode; tall?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      className={cx('flex min-w-0 flex-col rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong', tall && '@5xl:row-span-2')}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-[13px] font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </a>
  );
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
/** One week's value, or the period's total when no week is hovered. */
const pick = (values: number[], week: number | null) => (week === null ? sum(values) : values[week]!);

/**
 * A card with a weekly bar chart: title, the period (or the hovered week), the figure for either, and the bars
 * between the first week's date and this week. Without `up` (still loading) the chart is a placeholder.
 */
function ChartCard({
  title,
  href,
  weeks,
  period = PERIOD,
  aside,
  up,
  down,
  figure,
}: {
  title: string;
  href: string;
  weeks: number[];
  period?: string;
  aside?: ReactNode;
  up?: Series;
  down?: Series;
  figure: (week: number | null) => ReactNode;
}) {
  const [week, setWeek] = useState<number | null>(null);
  return (
    <Card href={href} title={title} aside={aside} tall>
      <p className="mt-0.5 truncate text-[12px] text-subtle">{week === null ? period : week === weeks.length - 1 ? 'This week' : `Week of ${weekDay.format(weeks[week])}`}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3">{figure(week)}</div>
      {up ? (
        <WeekBars up={up} down={down} week={week} onWeek={setWeek} />
      ) : (
        <div className="mt-4 flex h-16 animate-shimmer items-center justify-center rounded-lg bg-elevated text-[11.5px] text-subtle">Counting…</div>
      )}
      <div className="mt-2 flex justify-between text-[11px] text-subtle tabular-nums">
        <span>{weekDay.format(weeks[0])}</span>
        <span>This week</span>
      </div>
    </Card>
  );
}

/** A big number with its unit, or signed and colored like a diff stat (lines added and removed). */
function Figure({ value, unit, sign, color }: { value: number | string; unit?: string; sign?: string; color?: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <b className="text-[24px] leading-8 font-semibold tracking-tight tabular-nums" style={{ color }}>
        {sign}
        {typeof value === 'number' ? formatCount(value) : value}
      </b>
      {unit && <span className="text-[12.5px] text-muted">{unit}</span>}
    </span>
  );
}

const BARS = 64;

/**
 * Rounded weekly bars: `up` above a baseline and `down` below it, on one scale so their sizes compare. The
 * hovered week is reported through `onWeek` and the others dim. Empty weeks keep a stub so the rhythm holds.
 */
function WeekBars({ up, down, week, onWeek }: { up: Series; down?: Series; week: number | null; onWeek: (week: number | null) => void }) {
  const upHeight = down ? BARS * 0.62 : BARS;
  const downHeight = BARS - upHeight - 3;
  const scale = Math.min(upHeight / Math.max(1, ...up.values), down ? downHeight / Math.max(1, ...down.values) : Infinity);
  const bar = (value: number, color: string) => (
    <span className="w-full rounded-[3px] transition-[height] duration-300" style={{ height: Math.max(3, value * scale), background: value ? color : 'var(--u-elevated)' }} />
  );
  return (
    <div className="relative mt-4 flex gap-1" style={{ height: BARS }} onMouseLeave={() => onWeek(null)}>
      {down && <span className="absolute inset-x-0 h-px bg-line" style={{ top: upHeight + 1 }} />}
      {up.values.map((value, i) => (
        <div key={i} onMouseEnter={() => onWeek(i)} className={cx('flex flex-1 flex-col transition-opacity', week !== null && week !== i && 'opacity-35')}>
          <div className="flex items-end" style={{ height: upHeight }}>
            {bar(value, up.color)}
          </div>
          {down && (
            <div className="mt-[3px] flex items-start" style={{ height: downHeight }}>
              {bar(down.values[i]!, down.color)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** The period's change against the same length of time before it, when there was activity then. */
function Trend({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const change = Math.round(((now - before) / before) * 100);
  return (
    <span
      title={`${formatCount(before)} in the ${PULSE_WEEKS} weeks before`}
      className={cx('shrink-0 rounded-full px-1.5 text-[11px] leading-5 font-medium tabular-nums', change >= 0 ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger')}
    >
      {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
    </span>
  );
}

function Legend({ items }: { items: [label: string, color: string][] }) {
  return (
    <span className="flex shrink-0 gap-2.5 text-[11px] text-subtle">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </span>
  );
}

const CHECK_COLORS: Record<CheckState, string> = {
  SUCCESS: 'var(--u-green)',
  FAILURE: 'var(--u-red)',
  ERROR: 'var(--u-red)',
  PENDING: 'var(--u-yellow)',
  EXPECTED: 'var(--u-yellow)',
};

/** Check rollups of the default branch's last commits: the pass rate, and each commit as a segment. */
function ChecksCard({ repo, checks, tall }: { repo: Repo; checks: Pulse['checks']; tall: boolean }) {
  const settled = checks.filter((state) => state === 'SUCCESS' || state === 'FAILURE' || state === 'ERROR');
  const latest = checks.findLast((state): state is CheckState => state !== null) ?? 'PENDING';
  const passed = settled.filter((state) => state === 'SUCCESS').length;
  return (
    <Card
      href={`/${repo.nameWithOwner}/actions`}
      title={
        <>
          CI on <span className="font-mono text-[12px]">{repo.defaultBranchRef?.name}</span>
        </>
      }
      aside={
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-subtle">
          <span className="size-1.5 rounded-full" style={{ background: CHECK_COLORS[latest] }} />
          {latest === 'SUCCESS' ? 'Passing' : latest === 'FAILURE' || latest === 'ERROR' ? 'Failing' : 'Running'}
        </span>
      }
      tall={tall}
    >
      <div className="mt-2">
        <Figure value={settled.length ? `${Math.round((passed / settled.length) * 100)}%` : '–'} unit={`of the last ${checks.length} passed`} />
      </div>
      <div className="mt-auto flex h-4 gap-[3px] pt-1">
        {checks.map((state, i) => (
          <span key={i} className="flex-1 rounded-[3px]" style={{ background: state ? CHECK_COLORS[state] : 'var(--u-elevated)' }} />
        ))}
      </div>
    </Card>
  );
}

function ReleaseCard({ release, tall }: { release: NonNullable<Pulse['release']>; tall: boolean }) {
  return (
    <Card
      href={release.url}
      title="Latest release"
      aside={release.publishedAt && <span className="shrink-0 text-[11px] text-subtle">{timeAgo(release.publishedAt)}</span>}
      tall={tall}
    >
      <div className="mt-auto flex min-w-0 items-center gap-2 pt-2">
        <b className="truncate font-mono text-[17px] leading-8 font-semibold tracking-tight">{release.tagName}</b>
        {release.unreleased !== null && (
          <span
            className={cx('shrink-0 rounded-full px-2 text-[11px] leading-5 font-medium', release.unreleased ? 'bg-warning/12 text-warning' : 'bg-success/12 text-success')}
          >
            {release.unreleased ? `${formatCount(release.unreleased)} unreleased` : 'Up to date'}
          </span>
        )}
      </div>
    </Card>
  );
}

function PulseSkeleton() {
  return (
    <Grid wide={5}>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[223px] rounded-xl @5xl:row-span-2" />
      ))}
    </Grid>
  );
}

/** "40m", "5h", "3d". */
function formatHours(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  return hours < 48 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;
}
