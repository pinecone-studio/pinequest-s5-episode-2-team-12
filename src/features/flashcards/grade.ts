// One SM-2 grade written to card_states (+1 XP per card per day). Shared by the gradeFlashcard action
// and the offline replay in /api/offline/flashcards, which passes the time the card was graded.
import type { SupabaseClient } from '@supabase/supabase-js';
import { type Grade, newState, type ReviewState, review } from '@/lib/sm2';
import { dayKey } from '@/lib/time';
import { awardXp } from '@/server/xp';
import { CUSTOM_KEY, FLASHCARDS } from './lib/decks';

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

/** A bundled card key, or an admin-written card (custom_cards, migration 0018) that still exists. */
export async function isCardKey(db: SupabaseClient, key: string) {
  if (KEYS.has(key)) return true;
  if (!CUSTOM_KEY.test(key)) return false;
  const { data: card } = await db
    .from('custom_cards')
    .select('id')
    .eq('id', key.slice('custom/'.length))
    .maybeSingle();
  return Boolean(card);
}

export async function applyGrade(
  db: SupabaseClient,
  userId: string,
  key: string,
  grade: Grade,
  now: number,
): Promise<ReviewState | null> {
  const { data } = await db
    .from('card_states')
    .select('card_id, reps, interval_days, ease, due_at, lapses, box')
    .eq('user_id', userId)
    .eq('card_id', key)
    .maybeSingle();
  const before = data ? stateFromRow(data as Row) : newState(now);
  const next = review(before, grade, now);
  const { error } = await db.from('card_states').upsert(
    {
      user_id: userId,
      card_id: key,
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
  if (error) return null;
  await awardXp(userId, XP_PER_CARD, 'cards', `flash:${dayKey(now)}:${key}`);
  return next;
}
