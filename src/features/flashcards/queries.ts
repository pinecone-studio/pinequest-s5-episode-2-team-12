// /flashcards reads for a signed-in student, and which drafted cards an admin approved.
import { getDb } from '@/lib/supabase/server';
import {
  type CustomCardRow,
  customFlashcard,
  FLASHCARDS,
  type FlashCard,
  type FlashState,
} from './lib/decks';

type Row = {
  card_id: string;
  reps: number;
  interval_days: number;
  ease: number;
  due_at: string;
  lapses: number;
  box: number;
  first_seen_at: string | null;
};

export async function listFlashStates(userId: string): Promise<Record<string, FlashState>> {
  const db = await getDb();
  if (!db) return {};
  const { data, error } = await db
    .from('card_states')
    .select('card_id, reps, interval_days, ease, due_at, lapses, box, first_seen_at')
    .eq('user_id', userId);
  if (error) throw error;
  const out: Record<string, FlashState> = {};
  for (const r of (data ?? []) as Row[]) {
    // the old /cards screens stored bare card ids («sum»); /flashcards keys are «deck/card»
    const key = r.card_id.includes('/') ? r.card_id : FLASHCARDS.find((c) => c.id === r.card_id)?.key;
    if (!key || out[key]) continue;
    const due = Date.parse(r.due_at);
    out[key] =
      r.reps === 0 && r.box > 0
        ? { reps: r.box, interval: [0, 1, 3, 7, 14][r.box] ?? 0, ease: 2.5, due, lapses: 0 }
        : { reps: r.reps, interval: r.interval_days, ease: Number(r.ease), due, lapses: r.lapses };
    if (r.first_seen_at) out[key].first = Date.parse(r.first_seen_at);
  }
  return out;
}

/** Admin-written word cards (custom_cards), oldest first so new ones join the end of the deck. */
export async function listCustomCards(group: string): Promise<FlashCard[]> {
  const db = await getDb();
  if (!db) return [];
  const { data, error } = await db
    .from('custom_cards')
    .select('id, front, back, ex, hook')
    .order('created_at')
    .limit(500);
  if (error) return [];
  return ((data ?? []) as CustomCardRow[]).map((r) => customFlashcard(r, group));
}

export async function listReviewedCards(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from('content_reviews').select('item_id').eq('kind', 'card');
  return (data ?? []).map((r) => r.item_id as string);
}
