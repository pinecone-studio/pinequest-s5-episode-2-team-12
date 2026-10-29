import { TZ } from '@/lib/time';

const DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** "2026-10-28" in Ulaanbaatar time. */
export function formatDay(iso: string): string {
  return DATE.format(new Date(iso));
}

/** "2026-10-28 14:05" in Ulaanbaatar time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${DATE.format(d)} ${TIME.format(d)}`;
}

/** "10/28" from a "2026-10-28" day key, for chart labels. */
export function shortDay(day: string): string {
  return `${day.slice(5, 7)}/${day.slice(8, 10)}`;
}
