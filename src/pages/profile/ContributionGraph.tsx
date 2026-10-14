type Level = 'NONE' | 'FIRST_QUARTILE' | 'SECOND_QUARTILE' | 'THIRD_QUARTILE' | 'FOURTH_QUARTILE';

export type ContributionWeek = {
  contributionDays: { date: string; contributionCount: number; contributionLevel: Level }[];
};

const fill: Record<Level, string> = {
  NONE: 'var(--u-elevated)',
  FIRST_QUARTILE: 'color-mix(in srgb, var(--u-accent) 30%, var(--u-elevated))',
  SECOND_QUARTILE: 'color-mix(in srgb, var(--u-accent) 55%, var(--u-elevated))',
  THIRD_QUARTILE: 'color-mix(in srgb, var(--u-accent) 80%, var(--u-elevated))',
  FOURTH_QUARTILE: 'var(--u-accent)',
};

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });

/** Year heatmap that stretches to its container: one column per week, one row per weekday. */
export function ContributionGraph({ weeks }: { weeks: ContributionWeek[] }) {
  const columns = weeks.length;
  const months = weeks.flatMap((week, index) => {
    const first = week.contributionDays[0];
    if (!first) return [];
    const date = new Date(first.date);
    const previous = weeks[index - 1]?.contributionDays[0];
    const changed = !previous || new Date(previous.date).getUTCMonth() !== date.getUTCMonth();
    // Skip a label squeezed into the first partial column.
    return changed && index < columns - 2 && (index > 0 || date.getUTCDate() <= 7) ? [{ index, label: monthFormat.format(date) }] : [];
  });

  return (
    <div>
      <div className="relative mb-1.5 h-4 text-[11px] text-subtle">
        {months.map((m) => (
          <span key={m.index} className="absolute" style={{ left: `${(m.index / columns) * 100}%` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="grid justify-between gap-[3px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 13px))` }}>
        {weeks.map((week, w) => (
          <div key={w} className="grid grid-rows-7 gap-[3px]">
            {week.contributionDays.map((day) => (
              <div
                key={day.date}
                title={`${day.contributionCount || 'No'} contribution${day.contributionCount === 1 ? '' : 's'} · ${dayFormat.format(new Date(day.date))}`}
                className="aspect-square rounded-[2.5px] transition-transform hover:scale-125"
                style={{ background: fill[day.contributionLevel], gridRowStart: new Date(day.date).getUTCDay() + 1 }}
              />
            ))}
          </div>
        ))}
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
