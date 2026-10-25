'use server';
// The mistake notebook: question previews (no answers) and re-answering a note. The server grades; signed in
// it also moves the note on the SM-2 schedule in `mistakes`.
import { z } from 'zod';
import { type PublicQuestion, toPublic } from '@/features/exam/lib/mock';
import { correctAnswerText, isCorrect } from '@/features/roadmap/lib/grade';
import { getDb } from '@/lib/supabase/server';
import { questionById } from '@/server/bank';
import { getAdminDb } from '@/server/db';
import { awardXp } from '@/server/xp';
import { afterReview, type NoteState } from './lib/notebook';

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
  const q = parsed.success ? questionById(parsed.data.qid) : undefined;
  if (!parsed.success || !q) return { ok: false, reason: 'invalid_input' };
  const correct = isCorrect(q, parsed.data.answer);
  const now = Date.now();
  let state: NoteState | null = null;
  const db = await getDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const admin = getAdminDb();
  if (user && admin) {
    const { data } = await admin
      .from('mistakes')
      .select('reps, interval_days, ease, lapses, due_at, resolved')
      .eq('user_id', user.id)
      .eq('question_id', q.id)
      .maybeSingle();
    if (data) {
      state = afterReview(
        {
          reps: data.reps,
          interval: data.interval_days,
          ease: Number(data.ease),
          lapses: data.lapses,
          due: Date.parse(data.due_at),
          resolved: data.resolved,
        },
        correct,
        now,
      );
      await admin
        .from('mistakes')
        .update({
          reps: state.reps,
          interval_days: state.interval,
          ease: state.ease,
          lapses: state.lapses,
          due_at: new Date(state.due).toISOString(),
          resolved: state.resolved,
        })
        .eq('user_id', user.id)
        .eq('question_id', q.id);
      if (correct) await awardXp(user.id, 3, 'mistake-review', `mistake:${q.id}:${state.reps}`);
    }
  } else if (input.state) {
    state = afterReview(input.state, correct, now);
  }
  return { ok: true, correct, correctText: correctAnswerText(q), explain: q.explain, state };
}
