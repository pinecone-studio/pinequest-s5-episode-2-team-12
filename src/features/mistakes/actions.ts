'use server';
// The mistake notebook: question previews (no answers) and re-answering a note. The server grades; signed in
// it also moves the note on the SM-2 schedule in `mistakes`.
import { z } from 'zod';
import { type PublicQuestion, toPublic } from '@/features/exam/lib/mock';
import { correctAnswerText } from '@/features/roadmap/lib/grade';
import { questionById } from '@/server/bank';
import { afterReview, type NoteState } from './lib/notebook';
import { submitQuestionAnswer } from './submission-actions';

export type Preview = PublicQuestion & { topicId?: number };

export async function mistakePreviews(qids: string[]): Promise<Preview[]> {
  return qids
    .slice(0, 300)
    .map((id) => questionById(id))
    .filter((q) => q !== undefined)
    .map((q) => ({ ...toPublic(q), topicId: q.topicId }));
}

export type CheckResult =
  | { ok: true; correct: boolean; correctText: string; explain: string; state: NoteState | null }
  | { ok: false; reason: 'invalid_input' };

const Input = z.object({ qid: z.string().max(64), answer: z.string().max(40), state: z.any().optional() });

export async function checkMistake(input: {
  qid: string;
  answer: string;
  state?: NoteState;
}): Promise<CheckResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const result = await submitQuestionAnswer({
    qid: parsed.data.qid,
    questionSource: 'practice',
    answer: parsed.data.answer,
  });
  if (!result.ok) return { ok: false, reason: 'invalid_input' };
  const q = questionById(parsed.data.qid);
  // Compatibility for older callers: wrong feedback never discloses the answer or explanation.
  return {
    ok: true,
    correct: result.correct,
    correctText: result.correct && q ? correctAnswerText(q) : '',
    explain: result.correct ? (q?.explain ?? '') : '',
    state: input.state ? afterReview(input.state, result.correct, Date.now()) : null,
  };
}
