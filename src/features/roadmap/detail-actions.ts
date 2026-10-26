'use server';
// The stop panel's content, fetched when a pin is opened. Static content for everyone, plus (signed in) how
// many questions on the topic the student has answered wrong. Demo mode counts from localStorage instead.
import { getDb } from '@/lib/supabase/server';
import { type StopDetail, stopDetail } from './content/details';
import { STOPS } from './stops';

export type StopDetailResult = StopDetail & { missed: number | null };

export async function loadStopDetail(no: number): Promise<StopDetailResult | null> {
  if (!Number.isInteger(no) || !STOPS.some((s) => s.no === no)) return null;
  const detail = stopDetail(no);
  const db = await getDb();
  if (!db) return { ...detail, missed: null };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ...detail, missed: null };
  const { data, error } = await db
    .from('problem_attempts')
    .select('question_id')
    .eq('user_id', user.id)
    .eq('topic_id', no)
    .eq('correct', false)
    .limit(500);
  return { ...detail, missed: error ? null : new Set((data ?? []).map((r) => r.question_id)).size };
}
