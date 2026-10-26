// Stats derived from xp_events (the single source of truth for XP): total, level, study days and streak.
import { calculateLevel } from '@/lib/level';
import { getUlaanbaatarDate } from '@/lib/streak';
import type { Stats } from '@/types';

export type XpRow = { amount: number; at: string };

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Streak = consecutive Ulaanbaatar days with XP, ending today — or yesterday, so the streak survives until
 * the student has had a chance to study today.
 */
export function streakOf(days: readonly string[], today = getUlaanbaatarDate()): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function statsFromXp(rows: readonly XpRow[], today = getUlaanbaatarDate()): Stats {
  const xp = rows.reduce((s, r) => s + r.amount, 0);
  const days = [...new Set(rows.map((r) => getUlaanbaatarDate(new Date(r.at))))].sort();
  return { xp, level: calculateLevel(xp).level, streak: streakOf(days, today), days, mastery: {} };
}
