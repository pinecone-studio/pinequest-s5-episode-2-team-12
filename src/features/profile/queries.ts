// Section F · profile reads for a signed-in student. Demo mode reads localStorage in the browser instead.
import { mockBank } from '@/features/exam/engine';
import { leaderboardRows } from '@/features/social/queries';
import { getDb } from '@/lib/supabase/server';
import type { QuestionMeta } from './lib/radar';
import { type ProfileRanks, rankSummary } from './lib/ranks';

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

/** Use the same scope, metric and privacy rules as the leaderboard page. */
export async function weeklyBoards(userId: string) {
  const [national, aimag, friends] = await Promise.all(
    (['national', 'aimag', 'friends'] as const).map((scope) => leaderboardRows(scope, 'xp_week', userId)),
  );
  return { national, aimag, friends };
}

export async function weeklyRanks(userId: string): Promise<ProfileRanks> {
  const boards = await weeklyBoards(userId);
  return {
    national: rankSummary(boards.national),
    aimag: rankSummary(boards.aimag),
    friends: rankSummary(boards.friends),
  };
}

/** question id → [topic, difficulty] for every question in the bank (small; lets the browser resolve answers). */
export function questionMeta(): QuestionMeta {
  const out: QuestionMeta = {};
  for (const q of mockBank().bank.values()) if (q.topicId) out[q.id] = [q.topicId, q.difficulty];
  return out;
}
