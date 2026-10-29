'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  mapOfficialRow,
  OFFICIAL_COLUMNS,
  OFFICIAL_TABLE,
  type OfficialRow,
} from '@/features/practice/lib/official';
import { getQuestion } from '@/features/practice/queries';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/supabase/server';
import { questionById } from '@/server/bank';
import { getAdminDb } from '@/server/db';
import { awardXp } from '@/server/xp';
import {
  persistSubmission,
  processSubmission,
  type RetryQuestion,
  type SubmissionResult,
} from './lib/submission';

const Ref = z.object({
  qid: z.string().trim().min(1).max(128),
  questionSource: z.enum(['practice', 'official']).default('practice'),
});

export async function loadRetryQuestions(input: unknown): Promise<RetryQuestion[]> {
  const refs = z.array(Ref).max(500).parse(input);
  const items: RetryQuestion[] = [];
  const officialIds = refs.filter((ref) => ref.questionSource === 'official').map((ref) => ref.qid);
  if (officialIds.length) {
    const db = await getDb();
    if (!db) throw new Error('Асуултын сантай холбогдож чадсангүй.');
    const { data, error } = await db.from(OFFICIAL_TABLE).select(OFFICIAL_COLUMNS).in('id', officialIds);
    if (error) throw new Error('Асуултуудыг ачаалж чадсангүй.');
    items.push(
      ...((data ?? []) as OfficialRow[]).map((row) => ({
        questionSource: 'official' as const,
        question: mapOfficialRow(row),
      })),
    );
  }
  for (const ref of refs.filter((ref) => ref.questionSource === 'practice')) {
    const q = (await getQuestion(ref.qid)) ?? questionById(ref.qid);
    if (q) items.push({ questionSource: 'practice', question: q });
  }
  return items;
}

export async function submitQuestionAnswer(input: unknown): Promise<SubmissionResult> {
  const result = await processSubmission(input, {
    session: getSession,
    load: async (ref) => (await loadRetryQuestions([ref]))[0],
    persist: async (userId, ref, answer, correct) => {
      const admin = getAdminDb();
      if (!admin) throw new Error('Missing server database configuration');
      // Preserve the notebook's review reward, once per saved recovery of a missed question.
      const previous = correct
        ? await admin
            .from('mistakes')
            .select('id,last_wrong_at')
            .match({
              user_id: userId,
              question_id: ref.qid,
              question_source: ref.questionSource ?? 'practice',
              resolved: false,
            })
            .maybeSingle()
        : null;
      if (previous?.error) throw previous.error;
      await persistSubmission(admin, userId, ref, answer, correct);
      if (previous?.data)
        await awardXp(
          userId,
          3,
          'mistake-review',
          `mistake:${previous.data.id}:${previous.data.last_wrong_at}`,
        ).catch(() => {});
    },
  });
  if (result.ok && result.storage === 'server') revalidatePath('/mistakes');
  return result;
}
