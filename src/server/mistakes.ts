// The mistake notebook fills itself: every wrong answer graded on the server is saved once per question
// (a new miss on a known question puts it back to «due now»). Service role; call after grading.
import { getAdminDb } from './db';

export type MistakeSource = 'stop' | 'placement' | 'testout' | 'mock' | 'daily' | 'duel' | 'practice';
export type Missed = { qid: string; chosen: string };

export async function recordMistakes(userId: string, missed: readonly Missed[], source: MistakeSource) {
  const db = getAdminDb();
  if (!db || !missed.length) return;
  const now = new Date().toISOString();
  const unique = [...new Map(missed.map((m) => [m.qid, m])).values()];
  await db.from('mistakes').upsert(
    unique.map((m) => ({
      user_id: userId,
      question_id: m.qid,
      question_source: 'practice',
      chosen: m.chosen.slice(0, 200),
      source,
      last_wrong_at: now,
      resolved: false,
      reps: 0,
      interval_days: 0,
      due_at: now,
    })),
    { onConflict: 'user_id,question_id,question_source' },
  );
}
