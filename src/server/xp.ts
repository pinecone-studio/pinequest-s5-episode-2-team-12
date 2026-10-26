// Trusted XP and badge writes. Every award has an idempotency key (xp_events.unique(user_id, key)),
// so retries and double submits count once. Server-only: call from Server Actions after validation.
import type { XpReason } from '@/types';
import { getAdminDb } from './db';

export type AwardResult =
  | { ok: true; awarded: boolean }
  | { ok: false; reason: 'no_service_role' | 'database_error' };

export async function awardXp(
  userId: string,
  amount: number,
  reason: XpReason | string,
  key: string,
): Promise<AwardResult> {
  const db = getAdminDb();
  if (!db) return { ok: false, reason: 'no_service_role' };
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000) return { ok: true, awarded: false };
  const { data, error } = await db
    .from('xp_events')
    .upsert({ user_id: userId, amount, reason, key }, { onConflict: 'user_id,key', ignoreDuplicates: true })
    .select('id');
  if (error) return { ok: false, reason: 'database_error' };
  return { ok: true, awarded: (data ?? []).length > 0 };
}

/** Grants badges (no-op for ones already earned). Returns the ids that were new. */
export async function awardBadges(userId: string, badgeIds: string[]): Promise<string[]> {
  const db = getAdminDb();
  if (!db || !badgeIds.length) return [];
  const { data, error } = await db
    .from('user_badges')
    .upsert(
      badgeIds.map((badge_id) => ({ user_id: userId, badge_id })),
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    )
    .select('badge_id');
  if (error) return [];
  return (data ?? []).map((r) => r.badge_id as string);
}
