import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CheckState } from '@/github/types';
import { cx } from '@/lib/cx';
import { formatCount, formatDate, timeAgo } from '@/lib/time';
import { Skeleton } from '@/ui/primitives';
import { PULSE_WEEKS, repoChurnQuery, repoPulseQuery, type Pulse } from './pulse';
import type { Repo } from './query';

const weekDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

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
  const onBranch = repo.defaultBranchRef && `On ${repo.defaultBranchRef.name}`;
  const showChurn = churn.data !== null && !churn.isError;
  const hasChecks = checks.some((state) => state !== null);
  const charts = 2 + Number(repo.hasIssuesEnabled) + Number(showChurn);
  const statuses = Number(hasChecks) + Number(!!release);
  return (
    <Grid cards={charts + statuses} wide={charts + Math.sign(statuses)}>
      <ChartCard
        title="Commits"
        href={`/${nwo}/commits`}
        note={onBranch}
        weeks={weeks}
        aside={<Trend now={sum(commits)} before={pulse.data.commitsBefore} />}
        up={{ values: commits, color: 'var(--u-accent)' }}
        figure={(i) => <Figure value={pick(commits, i)} unit={pick(commits, i) === 1 ? 'commit' : 'commits'} />}
      />
      <ChartCard
        title="Pull requests"
        href={`/${nwo}/pulls?q=${encodeURIComponent('is:pr is:merged')}`}
        note={mergeHours === null ? `${formatCount(repo.pullRequests.totalCount)} open` : `~${formatHours(mergeHours)} to merge`}
        weeks={weeks}
        aside={<Trend now={sum(merged)} before={pulse.data.mergedBefore} />}
        up={{ values: merged, color: 'var(--u-purple)' }}
        figure={(i) => <Figure value={pick(merged, i)} unit="merged" />}
      />
      {repo.hasIssuesEnabled && (
        <ChartCard
          title="Issues"
          href={`/${nwo}/issues`}
          note={`${formatCount(repo.issues.totalCount)} open`}
          weeks={weeks}
          aside={<Legend items={[['Opened', 'var(--u-green)'], ['Closed', 'var(--u-purple)']]} />}
          up={{ values: opened, color: 'var(--u-green)' }}
          down={{ values: closed, color: 'var(--u-purple)' }}
          figure={(i) => <Pair first={{ value: pick(opened, i), color: 'var(--u-green)' }} second={{ value: pick(closed, i), color: 'var(--u-purple)' }} />}
        />
      )}
      {showChurn && (
        <ChartCard
          title="Lines changed"
          href={`/${nwo}/graphs/code-frequency`}
          note={onBranch}
          weeks={weeks}
          up={churn.data ? { values: churn.data.additions, color: 'var(--u-green)' } : undefined}
          down={churn.data ? { values: churn.data.deletions, color: 'var(--u-red)' } : undefined}
          figure={(i) =>
            churn.data ? (
              <Pair
                first={{ value: pick(churn.data.additions, i), color: 'var(--u-green)', sign: '+' }}
                second={{ value: pick(churn.data.deletions, i), color: 'var(--u-red)', sign: '−' }}
              />
            ) : (
              <Skeleton className="h-7 w-28" />
            )
          }
        />
      )}
      {hasChecks && <ChecksCard repo={repo} checks={checks} paired={statuses === 2} />}
      {release && <ReleaseCard release={release} paired={statuses === 2} />}
    </Grid>
  );
}

// Whole class names, which Tailwind can see, by how many columns the strip has when wide.
const WIDE_COLUMNS: Record<number, string> = { 2: '@5xl:grid-cols-2', 3: '@5xl:grid-cols-3', 4: '@5xl:grid-cols-4', 5: '@5xl:grid-cols-5' };

/**
 * The cards' grid, sized by the room the page gives it. Wide, it's one row of `wide` columns with the status
 * cards stacked in the last (charts span both rows); narrower, the `cards` flow three to a row, or two when
 * that splits them evenly.
 */
function Grid({ cards, wide, children }: { cards: number; wide: number; children: ReactNode }) {
  return (
    <div className="@container mb-8">
      <div className={cx('grid gap-3 @lg:grid-cols-2', (cards % 2 === 1 || cards % 3 === 0) && '@3xl:grid-cols-3', WIDE_COLUMNS[wide])}>{children}</div>
    </div>
  );
}

/**
 * A card linking to `href`. Every card has the same rows, so they line up side by side whatever the repo: the
 * title with `aside` at its right, a one-line note, a one-line figure, and a chart pinned to the bottom above a
 * footer. A `paired` card shares its column with another when the strip is wide, so there it drops the note and
 * footer (its chart shrinks itself) and spans one row instead of two.
 */
function Card({
  href,
  title,
  aside,
  note,
  figure,
  chart,
  footer,
  paired,
}: {
  href: string;
  title: ReactNode;
  aside?: ReactNode;
  note: ReactNode;
  figure: ReactNode;
  chart: ReactNode;
  footer?: [start: string, end: string];
  paired?: boolean;
}) {
  return (
    <a
      href={href}
      className={cx('flex min-w-0 flex-col rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong', !paired && '@5xl:row-span-2')}
    >
      <div className="flex h-5 items-center justify-between gap-2">
        <h2 className="truncate text-[13px] font-medium">{title}</h2>
        {aside}
      </div>
      <p className={cx('mt-0.5 truncate text-[12px] leading-[18px] text-subtle', paired && '@5xl:hidden')}>{note}</p>
      <div className={cx('mt-3 flex h-8 min-w-0 shrink-0 items-baseline overflow-hidden whitespace-nowrap', paired && '@5xl:mt-1.5')}>{figure}</div>
      <div className={cx('mt-auto pt-4', paired && '@5xl:pt-2')}>{chart}</div>
      {footer && (
        <div className={cx('mt-2 flex justify-between gap-2 text-[11px] whitespace-nowrap text-subtle tabular-nums', paired && '@5xl:hidden')}>
          <span>{footer[0]}</span>
          <span>{footer[1]}</span>
        </div>
      )}
    </a>
  );
}

type Series = { values: number[]; color: string };

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
/** One week's value, or the period's total when no week is hovered. */
const pick = (values: number[], week: number | null) => (week === null ? sum(values) : values[week]!);

/**
 * A card with a weekly bar chart. Hovering a week shows that week's figure, and its date in place of the note.
 * Without `up` (still loading) the chart is a placeholder.
 */
function ChartCard({
  title,
  href,
  note,
  weeks,
  aside,
  up,
  down,
  figure,
}: {
  title: string;
  href: string;
  note?: string | null;
  weeks: number[];
  aside?: ReactNode;
  up?: Series;
  down?: Series;
  figure: (week: number | null) => ReactNode;
}) {
  const [week, setWeek] = useState<number | null>(null);
  return (
    <Card
      href={href}
      title={title}
      aside={aside}
      note={week === null ? note || `Last ${PULSE_WEEKS} weeks` : week === weeks.length - 1 ? 'This week' : `Week of ${weekDay.format(weeks[week])}`}
      figure={figure(week)}
      chart={
        up ? (
          <WeekBars up={up} down={down} week={week} onWeek={setWeek} />
        ) : (
          <div className="flex h-16 animate-shimmer items-center justify-center rounded-lg bg-elevated text-[11.5px] text-subtle">Counting…</div>
        )
      }
      footer={[weekDay.format(weeks[0]), 'This week']}
    />
  );
}

const NUMBER = 'text-[24px] leading-8 font-semibold tracking-tight tabular-nums';

/** A big number with its unit. */
function Figure({ value, unit }: { value: number | string; unit: string }) {
  return (
    <>
      <b className={NUMBER}>{typeof value === 'number' ? formatCount(value) : value}</b>
      <span className="ml-1.5 truncate text-[12.5px] text-muted">{unit}</span>
    </>
  );
}

type Colored = { value: number; color: string; sign?: string };

/** Two numbers in their series' colors, each in a fixed half so hovering weeks doesn't move the second. */
function Pair({ first, second }: { first: Colored; second: Colored }) {
  return (
    <span className="grid w-full grid-cols-2 gap-2">
      {[first, second].map(({ value, color, sign }, i) => (
        <b key={i} className={cx(NUMBER, 'truncate')} style={{ color }}>
          {sign}
          {formatCount(value)}
        </b>
      ))}
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
    <div className="relative flex gap-1" style={{ height: BARS }} onMouseLeave={() => onWeek(null)}>
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

/** The period's change against the same length of time before it, when there was activity then. Past 2×, as a multiple. */
function Trend({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const ratio = now / before;
  const label = ratio >= 2 ? `${ratio.toFixed(ratio >= 10 ? 0 : 1)}×` : `${Math.abs(Math.round((ratio - 1) * 100))}%`;
  return (
    <span
      title={`${formatCount(before)} in the ${PULSE_WEEKS} weeks before`}
      className={cx(
        'shrink-0 rounded-full px-1.5 text-[11px] leading-5 font-medium whitespace-nowrap tabular-nums',
        ratio >= 1 ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger',
      )}
    >
      {ratio >= 1 ? '↑' : '↓'} {label}
    </span>
  );
}

function Legend({ items }: { items: [label: string, color: string][] }) {
  return (
    <span className="flex shrink-0 gap-2.5 text-[11px] whitespace-nowrap text-subtle">
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

/** Check rollups of the default branch's last commits: the pass rate, and each commit as a bar (a thin strip when `paired`). */
function ChecksCard({ repo, checks, paired }: { repo: Repo; checks: Pulse['checks']; paired: boolean }) {
  const settled = checks.filter((state) => state === 'SUCCESS' || state === 'FAILURE' || state === 'ERROR');
  const passed = settled.filter((state) => state === 'SUCCESS').length;
  const latest = checks.findLast((state): state is CheckState => state !== null) ?? 'PENDING';
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
      note={`Last ${checks.length} commits`}
      figure={<Figure value={settled.length ? `${Math.round((passed / settled.length) * 100)}%` : '–'} unit="passed" />}
      chart={
        <div className={cx('flex h-16 gap-[3px]', paired && '@5xl:h-3')}>
          {checks.map((state, i) => (
            <span key={i} className="flex-1 rounded-[3px]" style={{ background: state ? CHECK_COLORS[state] : 'var(--u-elevated)' }} />
          ))}
        </div>
      }
      footer={[`${checks.length} commits ago`, 'Latest']}
      paired={paired}
    />
  );
}

/** The latest release and how far the default branch has moved past it: a block of its own, or a chip by the tag when `paired`. */
function ReleaseCard({ release, paired }: { release: NonNullable<Pulse['release']>; paired: boolean }) {
  const { unreleased } = release;
  const ahead = unreleased !== null && (
    <span className={cx('ml-2 hidden shrink-0 self-center rounded-full @5xl:inline-flex px-2 text-[11px] leading-5 font-medium', unreleased ? 'bg-warning/12 text-warning' : 'bg-success/12 text-success')}>
      {unreleased ? `${formatCount(unreleased)} unreleased` : 'Up to date'}
    </span>
  );
  return (
    <Card
      href={release.url}
      title="Latest release"
      aside={release.publishedAt && <span className="shrink-0 text-[11px] text-subtle">{timeAgo(release.publishedAt)}</span>}
      note={release.publishedAt && `Published ${formatDate(release.publishedAt)}`}
      figure={
        <>
          <b className="truncate font-mono text-[18px] leading-8 font-semibold tracking-tight">{release.tagName}</b>
          {paired && ahead}
        </>
      }
      chart={
        unreleased !== null && (
          <div className={cx('flex h-16 flex-col justify-center rounded-lg bg-elevated px-3', paired && '@5xl:hidden')}>
              <b className={cx('text-[18px] leading-6 font-semibold tabular-nums', unreleased ? 'text-warning' : 'text-success')}>
                {unreleased ? formatCount(unreleased) : 'Up to date'}
              </b>
              <span className="truncate text-[11.5px] text-muted">{unreleased ? `commit${unreleased === 1 ? '' : 's'} since this release` : 'Nothing new since this release'}</span>
            </div>
        )
      }
      paired={paired}
    />
  );
}

function PulseSkeleton() {
  return (
    <Grid cards={5} wide={5}>
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
