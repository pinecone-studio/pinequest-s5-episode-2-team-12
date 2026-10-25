// Finished mock attempts of the signed-in student (RLS: own rows only). Demo mode reads localStorage instead.
import { getDb } from '@/lib/supabase/server';
import type { MockAttempt } from './lib/mock';

export async function listMockAttempts(userId: string, limit = 50): Promise<MockAttempt[]> {
  const db = await getDb();
  if (!db) return [];
  const { data, error } = await db
    .from('exams')
    .select('attempt')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => r.attempt as MockAttempt).filter((a) => a?.finishedAt);
}
