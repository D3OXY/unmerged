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

const shortDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
export const formatDate = (iso: string) => shortDate.format(new Date(iso));

const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });
export const formatMonthYear = (iso: string) => monthYear.format(new Date(iso));

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCount = (n: number) => compact.format(n);

/** "812 B", "4.2 KB", "13.0 MB": a file's size. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const clock = new Intl.DateTimeFormat('en', { timeStyle: 'short' });
/** "3:42 PM", from ms since the epoch. */
export const formatTime = (ms: number) => clock.format(ms);
