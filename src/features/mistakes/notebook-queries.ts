// Signed-in mistake notebook rows → entries + SM-2 states.

import { getDb } from '@/lib/supabase/server';
import { noteKey } from './lib/identity';
import type { Entry, MistakeSource, NoteState } from './lib/notebook';

export async function listNotebook(
  userId: string,
): Promise<{ entries: Entry[]; states: Record<string, NoteState & { reviewedAt?: number }> }> {
  const db = await getDb();
  if (!db) return { entries: [], states: {} };
  const readPage = (start: number) =>
    db
      .from('mistakes')
      .select(
        'question_id, question_source, chosen, source, last_wrong_at, resolved, reps, interval_days, ease, lapses, due_at',
      )
      .eq('user_id', userId)
      .order('last_wrong_at', { ascending: false })
      .order('id')
      .range(start, start + 499);
  const first = await readPage(0);
  if (first.error) throw first.error;
  const data = first.data ?? [];
  let size = data.length;
  while (size === 500) {
    const next = await readPage(data.length);
    if (next.error) throw next.error;
    size = next.data?.length ?? 0;
    data.push(...(next.data ?? []));
  }
  const entries: Entry[] = [];
  const states: Record<string, NoteState & { reviewedAt?: number }> = {};
  for (const r of data ?? []) {
    entries.push({
      qid: r.question_id,
      questionSource: r.question_source,
      chosen: r.chosen,
      source: r.source as MistakeSource,
      at: Date.parse(r.last_wrong_at),
    });
    states[noteKey({ qid: r.question_id, questionSource: r.question_source })] = {
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
