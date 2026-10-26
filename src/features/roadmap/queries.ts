// Section A · roadmap reads. Without Supabase every function returns content/roadmap (demo mode).
import { getDb } from '@/lib/supabase/server';
import { getQuestionsDb } from '@/server/db';
import type { Question } from '@/types';
import { ROADMAP } from './config';
import { BANK_TOPIC, placementPool, stopPool } from './content/bank';
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

const withTopic = (q: Question): Question =>
  q.topicId ? q : { ...q, topicId: BANK_TOPIC[q.id], format: q.choices ? 'mcq' : 'spr', pool: 'stop' };

/** Servable stop questions for a topic (server-only read; unreviewed rows filtered below). */
export async function listStopQuestions(topicId: number): Promise<Question[]> {
  const db = await getQuestionsDb();
  if (!db) return stopPool(topicId);
  const bankIds = Object.entries(BANK_TOPIC)
    .filter(([, t]) => t === topicId)
    .map(([id]) => id);
  let query = db.from('questions').select('content, reviewed');
  query = bankIds.length
    ? query.or(`and(topic_id.eq.${topicId},pool.eq.stop),id.in.(${bankIds.join(',')})`)
    : query.eq('topic_id', topicId).eq('pool', 'stop');
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? [])
    .filter((r) => ROADMAP.allowUnreviewed || r.reviewed)
    .map((r) => withTopic(r.content as Question));
  // nothing imported yet: in development fall back to the files so the roadmap is usable
  return rows.length || !ROADMAP.allowUnreviewed ? rows : stopPool(topicId);
}

export async function listPlacementQuestions(): Promise<Question[]> {
  const db = await getQuestionsDb();
  if (!db) return placementPool();
  const { data, error } = await db.from('questions').select('content, reviewed').eq('pool', 'placement');
  if (error) throw error;
  const rows = (data ?? [])
    .filter((r) => ROADMAP.allowUnreviewed || r.reviewed)
    .map((r) => r.content as Question);
  return rows.length || !ROADMAP.allowUnreviewed ? rows : placementPool();
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
