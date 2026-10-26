// Signed-in mistake notebook rows → entries + SM-2 states.
import { getDb } from '@/lib/supabase/server';
import type { Entry, MistakeSource, NoteState } from './lib/notebook';

export async function listNotebook(
  userId: string,
): Promise<{ entries: Entry[]; states: Record<string, NoteState & { reviewedAt?: number }> }> {
  const db = await getDb();
  if (!db) return { entries: [], states: {} };
  const { data, error } = await db
    .from('mistakes')
    .select('question_id, chosen, source, last_wrong_at, resolved, reps, interval_days, ease, lapses, due_at')
    .eq('user_id', userId)
    .order('last_wrong_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const entries: Entry[] = [];
  const states: Record<string, NoteState & { reviewedAt?: number }> = {};
  for (const r of data ?? []) {
    entries.push({
      qid: r.question_id,
      chosen: r.chosen,
      source: r.source as MistakeSource,
      at: Date.parse(r.last_wrong_at),
    });
    states[r.question_id] = {
      reps: r.reps,
      interval: r.interval_days,
      ease: Number(r.ease),
      lapses: r.lapses,
      due: Date.parse(r.due_at),
      resolved: r.resolved,
    };
  }
  return { entries, states };
}
