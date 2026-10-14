const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "3h ago", "yesterday", "just now". */
export function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
export const fullDate = (iso: string) => dateFormat.format(new Date(iso));

const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });
export const formatMonthYear = (iso: string) => monthYear.format(new Date(iso));

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCount = (n: number) => compact.format(n);
