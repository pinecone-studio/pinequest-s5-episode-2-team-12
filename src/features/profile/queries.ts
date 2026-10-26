// Section F · profile reads for a signed-in student. Demo mode reads localStorage in the browser instead.
import { mockBank } from '@/features/exam/engine';
import { getLeague } from '@/features/progress/queries';
import { getDb } from '@/lib/supabase/server';
import { isoWeekId } from '@/lib/time';
import type { QuestionMeta } from './lib/radar';

export type RawAnswer = { qid: string; topicId?: number; correct: boolean; at: number };

/** Recent answers from roadmap stops and the placement test (mocks come from their attempts). */
export async function listAnswers(userId: string, limit = 1000): Promise<RawAnswer[]> {
  const db = await getDb();
  if (!db) return [];
  const { data, error } = await db
    .from('problem_attempts')
    .select('question_id, topic_id, correct, at')
    .eq('user_id', userId)
    .order('at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    qid: r.question_id,
    topicId: r.topic_id ?? undefined,
    correct: r.correct,
    at: Date.parse(r.at),
  }));
}

/** 1-based place in this week's national XP table, or null when not on it. */
export async function weeklyRank(userId: string): Promise<{ rank: number; of: number } | null> {
  const rows = await getLeague(isoWeekId()).catch(() => []);
  const i = rows.findIndex((r) => r.userId === userId);
  return i < 0 ? null : { rank: i + 1, of: rows.length };
}

/** question id → [topic, difficulty] for every question in the bank (small; lets the browser resolve answers). */
export function questionMeta(): QuestionMeta {
  const out: QuestionMeta = {};
  for (const q of mockBank().pool) if (q.topicId) out[q.id] = [q.topicId, q.difficulty];
  return out;
}
