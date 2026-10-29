'use server';
// /flashcards writes. Signed in: SM-2 state per card in card_states (RLS: own rows). Demo mode returns
// { ok: false, reason: 'demo_mode' } and the browser keeps the state in localStorage.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminUserId } from '@/features/roadmap/admin';
import { GRADES, type Grade, newState, type ReviewState, review } from '@/lib/sm2';
import { getDb } from '@/lib/supabase/server';
import { dayKey } from '@/lib/time';
import { awardXp } from '@/server/xp';
import { CUSTOM_KEY, FLASHCARDS } from './lib/decks';

export type FlashResult =
  | { ok: true; state: ReviewState }
  | { ok: false; reason: 'demo_mode' | 'invalid_input' | 'database_error' };

const Input = z.object({ key: z.string().max(80), grade: z.enum(GRADES as [string, ...string[]]) });
const KEYS = new Set(FLASHCARDS.map((c) => c.key));
const XP_PER_CARD = 1;

type Row = {
  card_id: string;
  reps: number;
  interval_days: number;
  ease: number;
  due_at: string;
  lapses: number;
  box: number;
};

function stateFromRow(r: Row): ReviewState {
  // rows written by the old Leitner screens only have a box
  if (r.reps === 0 && r.box > 0)
    return {
      reps: r.box,
      interval: [0, 1, 3, 7, 14][r.box] ?? 0,
      ease: 2.5,
      due: Date.parse(r.due_at),
      lapses: 0,
    };
  return {
    reps: r.reps,
    interval: r.interval_days,
    ease: Number(r.ease),
    due: Date.parse(r.due_at),
    lapses: r.lapses,
  };
}

export async function gradeFlashcard(input: { key: string; grade: string }): Promise<FlashResult> {
  const parsed = Input.safeParse(input);
  const custom = parsed.success && CUSTOM_KEY.test(parsed.data.key);
  if (!parsed.success || (!KEYS.has(parsed.data.key) && !custom))
    return { ok: false, reason: 'invalid_input' };
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  if (custom) {
    // an admin-written card (custom_cards, migration 0018) must still exist
    const { data: card } = await db
      .from('custom_cards')
      .select('id')
      .eq('id', parsed.data.key.slice('custom/'.length))
      .maybeSingle();
    if (!card) return { ok: false, reason: 'invalid_input' };
  }
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, reason: 'demo_mode' };
  const now = Date.now();
  const { data } = await db
    .from('card_states')
    .select('card_id, reps, interval_days, ease, due_at, lapses, box')
    .eq('user_id', user.id)
    .eq('card_id', parsed.data.key)
    .maybeSingle();
  const before = data ? stateFromRow(data as Row) : newState(now);
  const next = review(before, parsed.data.grade as Grade, now);
  const { error } = await db.from('card_states').upsert(
    {
      user_id: user.id,
      card_id: parsed.data.key,
      reps: next.reps,
      interval_days: next.interval,
      ease: next.ease,
      lapses: next.lapses,
      due_at: new Date(next.due).toISOString(),
      box: Math.min(4, next.reps),
      ...(!data && { first_seen_at: new Date(now).toISOString() }),
    },
    { onConflict: 'user_id,card_id' },
  );
  if (error) return { ok: false, reason: 'database_error' };
  await awardXp(user.id, XP_PER_CARD, 'cards', `flash:${dayKey(now)}:${parsed.data.key}`);
  return { ok: true, state: next };
}

/** Admin: mark a drafted card as reviewed (or back to draft). */
export async function reviewFlashcard(
  key: string,
  reviewed: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  const who = await adminUserId();
  if ('reason' in who) return { ok: false, reason: who.reason };
  if (!KEYS.has(key)) return { ok: false, reason: 'invalid_input' };
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  // admin_review_card (migration 0018) checks the role again; no service-role key needed
  const { error } = await db.rpc('admin_review_card', { p_key: key, p_reviewed: reviewed === true });
  if (error) return { ok: false, reason: 'database_error' };
  revalidatePath('/admin/flashcards');
  revalidatePath('/flashcards');
  return { ok: true };
}
