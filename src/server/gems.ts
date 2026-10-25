// Trusted gem awards (service role), idempotent by key like awardXp. Call from Server Actions after grading.
import { EARN } from '@/features/shop/catalog';
import { getAdminDb } from './db';

export async function awardGems(
  userId: string,
  amount: number,
  reason: string,
  key: string,
): Promise<boolean> {
  const db = getAdminDb();
  if (!db || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1000) return false;
  const { data, error } = await db
    .from('gem_events')
    .upsert({ user_id: userId, amount, reason, key }, { onConflict: 'user_id,key', ignoreDuplicates: true })
    .select('id');
  return !error && (data ?? []).length > 0;
}

/** Streak milestones (7 and 30 days) pay once per run; the run is named by the day it started. */
export async function awardStreakGems(userId: string, streak: number, runStartDay: string) {
  for (const [days, gems] of Object.entries(EARN.streak))
    if (streak >= Number(days)) await awardGems(userId, gems, 'streak', `streak:${days}:${runStartDay}`);
}

/** After any studying that earns XP: pay streak milestones the student has just reached. */
export async function afterStudy(userId: string) {
  const db = getAdminDb();
  if (!db) return;
  const { data } = await db.from('xp_events').select('amount, at').eq('user_id', userId).limit(5000);
  const { statsFromXp } = await import('@/features/progress/lib/stats');
  const stats = statsFromXp((data ?? []) as { amount: number; at: string }[]);
  if (stats.streak < 7) return;
  const last = stats.days.at(-1)!;
  const start = new Date(`${last}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (stats.streak - 1));
  await awardStreakGems(userId, stats.streak, start.toISOString().slice(0, 10));
}
