// Section A · roadmap reads. Without Supabase every function returns content/roadmap (demo mode).
import { getDb } from '@/lib/supabase/server';
import { getQuestionsDb, getQuestionsTable } from '@/server/db';
import type { Question } from '@/types';
import { ROADMAP } from './config';
import { placementPool, roadmapQuestionById, stopPool } from './content/bank';
import { type PlacementRow, type ProgressRow, type StopRow, stateFromRows } from './lib/db-map';
import type { ProblemAttempt, RoadmapState } from './types';

/** Signed-in Supabase user id, or null in demo mode / signed out. */
export async function currentUserId(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  return error || !user ? null : user.id;
}

export async function getRoadmap(userId: string): Promise<RoadmapState | null> {
  const db = await getDb();
  if (!db) return null;
  const [progress, stops, placement] = await Promise.all([
    db
      .from('roadmap_progress')
      .select('level, mastery, current_stop, regions_done')
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('roadmap_stops')
      .select('stop_no, status, best, stars, attempts, tested_out, completed_at')
      .eq('user_id', userId),
    db
      .from('placement_attempts')
      .select('skipped, module2, score, level, mastery, answers, finished_at')
      .eq('user_id', userId)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const r of [progress, stops, placement]) if (r.error) throw r.error;
  return stateFromRows(
    progress.data as ProgressRow | null,
    (stops.data ?? []) as StopRow[],
    placement.data as PlacementRow | null,
  );
}

/** Old imports may still carry the previous ordinal topic ids. Resolve by question identity. */
const withTopic = (q: Question): Question => {
  const active = roadmapQuestionById(q.id);
  return active
    ? {
        ...q,
        topicId: active.topicId,
        domain: active.domain,
        skill: active.skill,
        format: active.format,
        pool: active.pool,
      }
    : q;
};

async function curriculumPool(pool: 'stop' | 'placement', topicId?: number): Promise<Question[]> {
  const active = pool === 'stop' ? stopPool(topicId, true) : placementPool(true);
  const fallback = pool === 'stop' ? stopPool(topicId) : placementPool();
  const db = await getQuestionsDb();
  if (!db) return fallback;
  // Select by current ids so an old topic_id cannot serve questions from a different chapter.
  const { data, error } = await db
    .from(getQuestionsTable())
    .select('content, reviewed')
    .in(
      'id',
      active.map((q) => q.id),
    );
  if (error) throw error;
  const rows = (data ?? [])
    .filter((r) => ROADMAP.allowUnreviewed || r.reviewed)
    .map((r) => withTopic(r.content as Question));
  if (!ROADMAP.allowUnreviewed) return rows;
  const loaded = new Set(rows.map((q) => q.id));
  return [...rows, ...fallback.filter((q) => !loaded.has(q.id))];
}

/** Servable stop questions for the current curriculum, with the production review gate intact. */
export async function listStopQuestions(topicId: number): Promise<Question[]> {
  return curriculumPool('stop', topicId);
}

export async function listPlacementQuestions(): Promise<Question[]> {
  return curriculumPool('placement');
}

/** Recent answers on a topic (selection history: fresh draws, missed questions weigh more). */
export async function getHistory(userId: string, topicId: number): Promise<ProblemAttempt[]> {
  const db = await getDb();
  if (!db) return [];
  const { data, error } = await db
    .from('problem_attempts')
    .select('question_id, topic_id, correct, hint_used, time_ms, at')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .order('at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    qid: r.question_id,
    topicId: r.topic_id,
    correct: r.correct,
    hintUsed: r.hint_used,
    timeMs: r.time_ms,
    at: Date.parse(r.at),
  }));
}
