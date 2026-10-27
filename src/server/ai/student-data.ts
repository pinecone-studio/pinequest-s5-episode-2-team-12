// Server-only. A student's own answers and mistakes for Суу's planner and analyze skills.
// Signed in: read from Supabase (RLS: own rows only), so the browser can't send someone else's data.
// Demo (no account): the browser sends its localStorage history, checked by the schemas below.
import { z } from 'zod';
import { listNotebook } from '@/features/mistakes/notebook-queries';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/supabase/server';
import { questionById } from '@/server/bank';
import type { Attempt, MistakeEntry, QuestionFacts } from './student-input';

export const AttemptSchema = z.object({
  qid: z.string().min(1).max(80),
  topicId: z.number().int().min(1).max(26),
  correct: z.boolean(),
  timeMs: z.number().int().min(0).max(3_600_000),
  at: z.number().int().min(0),
});
export const MistakeSchema = z.object({
  qid: z.string().min(1).max(80),
  source: z.enum(['stop', 'placement', 'testout', 'mock', 'daily', 'duel', 'practice']),
  at: z.number().int().min(0),
});
/** What a demo browser may send (its own localStorage). Ignored for signed-in students. */
export const StudentDataSchema = z.object({
  attempts: z.array(AttemptSchema).max(3000).default([]),
  mistakes: z.array(MistakeSchema).max(1000).default([]),
});
export type StudentData = { attempts: Attempt[]; mistakes: MistakeEntry[] };

async function loadAttempts(userId: string): Promise<Attempt[]> {
  const db = await getDb();
  if (!db) return [];
  const { data, error } = await db
    .from('problem_attempts')
    .select('question_id, topic_id, correct, time_ms, at')
    .eq('user_id', userId)
    .order('at', { ascending: false })
    .limit(3000);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.topic_id)
    .map((r) => ({
      qid: r.question_id,
      topicId: r.topic_id as number,
      correct: r.correct,
      timeMs: r.time_ms ?? 0,
      at: Date.parse(r.at),
    }));
}

/** The signed-in student's data from the database, or the demo browser's own data. */
export async function studentData(sent: StudentData): Promise<StudentData> {
  const session = await getSession().catch(() => null);
  if (session?.kind !== 'user') return sent;
  const [attempts, notebook] = await Promise.all([
    loadAttempts(session.userId).catch(() => []),
    listNotebook(session.userId).catch(() => ({ entries: [] })),
  ]);
  return { attempts, mistakes: notebook.entries.map((e) => ({ qid: e.qid, source: e.source, at: e.at })) };
}

/** Topic, SAT words and Desmos rows of a bank question (answers never leave the server). */
export function questionFacts(qid: string): QuestionFacts | undefined {
  const q = questionById(qid);
  if (!q) return undefined;
  return { topicId: q.topicId, vocab: q.vocab, desmos: Boolean(q.desmos?.rows.length) };
}
