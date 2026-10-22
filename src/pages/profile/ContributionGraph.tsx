import { useMemo, useState, type MouseEvent } from 'react';

type Level = 'NONE' | 'FIRST_QUARTILE' | 'SECOND_QUARTILE' | 'THIRD_QUARTILE' | 'FOURTH_QUARTILE';

type ContributionDay = { date: string; contributionCount: number; contributionLevel: Level };

export type ContributionWeek = { contributionDays: ContributionDay[] };

const fill: Record<Level, string> = {
  NONE: 'var(--u-elevated)',
  FIRST_QUARTILE: 'color-mix(in srgb, var(--u-accent) 30%, var(--u-elevated))',
  SECOND_QUARTILE: 'color-mix(in srgb, var(--u-accent) 55%, var(--u-elevated))',
  THIRD_QUARTILE: 'color-mix(in srgb, var(--u-accent) 80%, var(--u-elevated))',
  FOURTH_QUARTILE: 'var(--u-accent)',
};

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });

const countLabel = (count: number) => `${count ? count.toLocaleString() : 'No'} contribution${count === 1 ? '' : 's'}`;

type Hover = { day: ContributionDay; week: number; left: number; top: number };

/**
 * Year heatmap that stretches to its container: one column per week, one row per weekday. One shared
 * tooltip follows the hovered day, so a hover re-renders only the tooltip, not every cell.
 */
export function ContributionGraph({ weeks }: { weeks: ContributionWeek[] }) {
  const columns = weeks.length;
  const [hover, setHover] = useState<Hover | null>(null);
  const months = weeks.flatMap((week, index) => {
    const first = week.contributionDays[0];
    if (!first) return [];
    const date = new Date(first.date);
    const previous = weeks[index - 1]?.contributionDays[0];
    const changed = !previous || new Date(previous.date).getUTCMonth() !== date.getUTCMonth();
    // Skip a label squeezed into the first partial column.
    return changed && index < columns - 2 && (index > 0 || date.getUTCDate() <= 7) ? [{ index, label: monthFormat.format(date) }] : [];
  });

  const cells = useMemo(
    () => (
      <div className="grid justify-between gap-[3px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 13px))` }}>
        {weeks.map((week, w) => (
          <div key={w} className="grid grid-rows-7 gap-[3px]">
            {week.contributionDays.map((day, d) => (
              <div
                key={day.date}
                role="img"
                aria-label={`${countLabel(day.contributionCount)} on ${dayFormat.format(new Date(day.date))}`}
                data-week={w}
                data-day={d}
                className="aspect-square rounded-[2.5px] transition-transform hover:scale-125"
                style={{ background: fill[day.contributionLevel], gridRowStart: new Date(day.date).getUTCDay() + 1 }}
              />
            ))}
          </div>
        ))}
      </div>
    ),
    [weeks, columns],
  );

  // One delegated handler for all cells. In the gaps between cells the last tooltip stays, so it does not flicker.
  const onCellOver = (e: MouseEvent) => {
    const cell = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-day]') : null;
    const week = Number(cell?.dataset.week);
    const day = weeks[week]?.contributionDays[Number(cell?.dataset.day)];
    if (cell && day) setHover({ day, week, left: cell.offsetLeft + cell.offsetWidth / 2, top: cell.offsetTop });
  };

  return (
    <div>
      <div className="relative mb-1.5 h-4 text-[11px] text-subtle">
        {months.map((m) => (
          <span key={m.index} className="absolute" style={{ left: `${(m.index / columns) * 100}%` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="relative" onMouseOver={onCellOver} onMouseLeave={() => setHover(null)}>
        {cells}
        {hover && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 mb-2 animate-pop rounded-lg border border-line-strong bg-elevated px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-xl shadow-black/25"
            // Slide from left- to right-aligned across the year, so edge columns stay inside the card.
            style={{ left: hover.left, bottom: `calc(100% - ${hover.top}px)`, translate: `-${(hover.week / Math.max(1, columns - 1)) * 100}% 0` }}
          >
            <div className="flex items-center gap-1.5 font-medium text-fg">
              <span className="size-2.5 rounded-[3px]" style={{ background: fill[hover.day.contributionLevel] }} />
              {countLabel(hover.day.contributionCount)}
            </div>
            <div className="text-muted">{dayFormat.format(new Date(hover.day.date))}</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-subtle">
        Less
        {Object.values(fill).map((color) => (
          <span key={color} className="size-2.5 rounded-[3px]" style={{ background: color }} />
        ))}
        More
      </div>
    </div>
  );
}
