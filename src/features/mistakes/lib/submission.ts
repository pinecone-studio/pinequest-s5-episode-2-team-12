import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { OfficialQuestion } from '@/features/practice/lib/official';
import { officialSolveIssue } from '@/features/practice/lib/topic-bank';
import { isCorrect } from '@/features/roadmap/lib/grade';
import { checkGridInAnswer } from '@/lib/check-answer';
import type { Question } from '@/types';
import type { QuestionRef } from './identity';

const SubmissionInput = z.object({
  qid: z.string().trim().min(1).max(128),
  questionSource: z.enum(['practice', 'official']).default('practice'),
  answer: z.string().trim().min(1).max(200),
});

export type RetryQuestion =
  | { questionSource: 'practice'; question: Question }
  | { questionSource: 'official'; question: OfficialQuestion };
export type SubmissionResult =
  | { ok: true; correct: boolean; storage: 'server' | 'demo' }
  | { ok: false; error: string };

export function gradeRetryQuestion(item: RetryQuestion, answer: string): boolean | null {
  if (item.questionSource === 'practice') return isCorrect(item.question, answer);
  const q = item.question;
  if (officialSolveIssue(q)) return null;
  return q.format === 'mcq' ? q.answer === answer.trim() : checkGridInAnswer(answer, q.accepted);
}

/** Trusted server only: callers must authenticate and grade before using this function. */
export async function persistSubmission(
  db: SupabaseClient,
  userId: string,
  ref: QuestionRef,
  answer: string,
  correct: boolean,
) {
  const identity = {
    user_id: userId,
    question_id: ref.qid,
    question_source: ref.questionSource ?? 'practice',
  };
  if (correct) {
    const { error } = await db.from('mistakes').update({ resolved: true }).match(identity);
    if (error) throw error;
  } else {
    const now = new Date().toISOString();
    const { error } = await db.from('mistakes').upsert(
      {
        ...identity,
        chosen: answer,
        source: 'practice',
        resolved: false,
        last_wrong_at: now,
        due_at: now,
        reps: 0,
        interval_days: 0,
      },
      { onConflict: 'user_id,question_id,question_source' },
    );
    if (error) throw error;
  }
}

export type SubmissionDependencies = {
  session: () => Promise<import('@/lib/session').Session | null>;
  load: (ref: QuestionRef) => Promise<RetryQuestion | undefined>;
  persist: (userId: string, ref: QuestionRef, answer: string, correct: boolean) => Promise<void>;
};

/** The client never supplies a trusted user ID or verdict. */
export async function processSubmission(
  input: unknown,
  deps: SubmissionDependencies,
): Promise<SubmissionResult> {
  const parsed = SubmissionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Хариултын өгөгдөл буруу байна.' };
  try {
    const session = await deps.session();
    if (!session) return { ok: false, error: 'Нэвтэрч орно уу.' };
    const ref = parsed.data;
    const item = await deps.load(ref);
    if (!item) return { ok: false, error: 'Асуулт олдсонгүй.' };
    const correct = gradeRetryQuestion(item, ref.answer);
    if (correct === null) return { ok: false, error: 'Асуултын өгөгдөл дутуу байна.' };
    if (session.kind === 'demo') return { ok: true, correct, storage: 'demo' };
    await deps.persist(session.userId, ref, ref.answer, correct);
    return { ok: true, correct, storage: 'server' };
  } catch {
    return { ok: false, error: 'Алдааны дэвтэр хадгалагдсангүй. Дахин оролдоно уу.' };
  }
}
