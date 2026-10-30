'use server';
// /flashcards writes. Signed in: SM-2 state per card in card_states (RLS: own rows). Demo mode returns
// { ok: false, reason: 'demo_mode' } and the browser keeps the state in localStorage.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminUserId } from '@/features/roadmap/admin';
import { GRADES, type Grade, type ReviewState } from '@/lib/sm2';
import { getDb } from '@/lib/supabase/server';
import { applyGrade, isCardKey } from './grade';
import { FLASHCARDS } from './lib/decks';

export type FlashResult =
  | { ok: true; state: ReviewState }
  | { ok: false; reason: 'demo_mode' | 'invalid_input' | 'database_error' };

const Input = z.object({ key: z.string().max(80), grade: z.enum(GRADES as [string, ...string[]]) });
const KEYS = new Set(FLASHCARDS.map((c) => c.key));

export async function gradeFlashcard(input: { key: string; grade: string }): Promise<FlashResult> {
  const parsed = Input.safeParse(input);
  const custom = parsed.success && CUSTOM_KEY.test(parsed.data.key);
  if (!parsed.success || (!KEYS.has(parsed.data.key) && !custom))
    return { ok: false, reason: 'invalid_input' };
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  if (!(await isCardKey(db, parsed.data.key))) return { ok: false, reason: 'invalid_input' };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, reason: 'demo_mode' };
  const next = await applyGrade(db, user.id, parsed.data.key, parsed.data.grade as Grade, Date.now());
  if (!next) return { ok: false, reason: 'database_error' };
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
