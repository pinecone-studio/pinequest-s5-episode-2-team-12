// All day boundaries (streaks, quests, reviews) use Mongolia time.
export const TZ = 'Asia/Ulaanbaatar';

/** YYYY-MM-DD for the given instant in Asia/Ulaanbaatar. */
export function dayKey(at: Date | number = Date.now()): string {
  const d = typeof at === 'number' ? new Date(at) : at;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export const DAY_MS = 86_400_000;

/** Milliseconds the zone's wall clock is ahead of UTC at instant `at`. */
function zoneOffset(at: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return wall - Math.floor(at / 1000) * 1000;
}

/** The instant 00:00 starts on `date` (YYYY-MM-DD) in `tz`. NaN for a malformed date. */
export function zonedMidnight(date: string, tz: string = TZ): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return Number.NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return Number.NaN;
  // first guess with the offset at UTC midnight, then correct once in case a DST change sits in between
  const guess = utc - zoneOffset(utc, tz);
  return utc - zoneOffset(guess, tz);
}

/** Days, hours, minutes until the test day starts in the student's zone; null once it has started. */
export function countdown(
  date: string,
  now: number,
  tz: string = TZ,
): { d: number; h: number; m: number } | null {
  const ms = zonedMidnight(date, tz) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}

/** ISO week id (2026-W43) of a YYYY-MM-DD day, the weekly league's key. */
export function isoWeekId(day: string = dayKey()): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const w =
    1 + Math.round((d.getTime() - jan4.getTime()) / DAY_MS / 7 - (3 - ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
