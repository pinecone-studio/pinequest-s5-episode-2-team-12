'use server';
// «Өдрийн сорил» steps. Signed in: one row per student per day in daily_attempts; the server serves one
// question at a time and times it. Demo: the browser keeps today's attempt and sends it back.
import { mockBank } from '@/features/exam/engine';
import { type PublicQuestion, toPublic } from '@/features/exam/lib/mock';
import { correctAnswerText } from '@/features/roadmap/lib/grade';
import { getDb } from '@/lib/supabase/server';
import { dayKey } from '@/lib/time';
import { getAdminDb } from '@/server/db';
import { recordMistakes } from '@/server/mistakes';
import { awardXp } from '@/server/xp';
import { answerDaily as answerStep, type DailyAttempt, startDaily as startStep } from './lib/daily';

export type DailyStep = {
  day: string;
  index: number;
  total: number;
  question: PublicQuestion | null;
  finished: boolean;
  correct: number;
  score: number;
  flagged: boolean;
  /** Feedback on the answer just sent (answers are revealed only after submitting). */
  last?: { correct: boolean; correctText: string; explain: string };
  /** Demo only. */
  attempt?: DailyAttempt;
};

const XP_FOR_DAILY = 20;

async function session() {
  const db = await getDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const admin = getAdminDb();
  return user && admin ? { userId: user.id, admin } : null;
}

function stepOf(a: DailyAttempt, demo: boolean, last?: DailyStep['last']): DailyStep {
  const { bank } = mockBank();
  const i = a.answers.length;
  const q = !a.finishedAt ? bank.get(a.ids[i]) : undefined;
  return {
    day: a.day,
    index: i,
    total: a.ids.length,
    question: q ? toPublic(q) : null,
    finished: Boolean(a.finishedAt),
    correct: a.correct,
    score: a.score,
    flagged: a.flagged,
    last,
    ...(demo && { attempt: a }),
  };
}

type Row = {
  question_ids: string[];
  answers: DailyAttempt['answers'];
  served_at: string | null;
  started_at: string;
  finished_at: string | null;
  correct: number;
  score: number;
  time_ms: number;
  flagged: boolean;
};

const fromRow = (day: string, r: Row): DailyAttempt => ({
  day,
  ids: r.question_ids,
  answers: r.answers ?? [],
  servedAt: r.served_at ?? r.started_at,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  correct: r.correct,
  score: r.score,
  timeMs: r.time_ms,
  flagged: r.flagged,
});

/** Today's challenge: resumes the existing attempt (one per day), or starts it. */
export async function startDaily(input: { attempt?: DailyAttempt } = {}): Promise<DailyStep> {
  const day = dayKey();
  const now = Date.now();
  const s = await session();
  if (!s) {
    const a = input.attempt?.day === day ? input.attempt : startStep(day, mockBank().pool, now);
    return stepOf(a, true);
  }
  const { data } = await s.admin
    .from('daily_attempts')
    .select('*')
    .eq('user_id', s.userId)
    .eq('day', day)
    .maybeSingle();
  if (data) return stepOf(fromRow(day, data as Row), false);
  const a = startStep(day, mockBank().pool, now);
  await s.admin.from('daily_attempts').insert({
    user_id: s.userId,
    day,
    question_ids: a.ids,
    served_at: a.servedAt,
    started_at: a.startedAt,
  });
  return stepOf(a, false);
}

export async function answerDaily(input: {
  answer: string;
  attempt?: DailyAttempt;
}): Promise<DailyStep | null> {
  const day = dayKey();
  const now = Date.now();
  const s = await session();
  const { bank } = mockBank();
  let current: DailyAttempt | null = null;
  if (s) {
    const { data } = await s.admin
      .from('daily_attempts')
      .select('*')
      .eq('user_id', s.userId)
      .eq('day', day)
      .maybeSingle();
    current = data ? fromRow(day, data as Row) : null;
  } else current = input.attempt?.day === day ? input.attempt : null;
  if (!current) return null;
  const r = answerStep(current, String(input.answer ?? ''), bank, now);
  if ('error' in r) return stepOf(current, !s);
  const q = bank.get(r.last.qid);
  const last = {
    correct: r.last.correct,
    correctText: q ? correctAnswerText(q) : '',
    explain: q?.explain ?? '',
  };
  if (s) {
    const a = r.attempt;
    await s.admin
      .from('daily_attempts')
      .update({
        answers: a.answers,
        current: a.answers.length,
        served_at: a.servedAt,
        finished_at: a.finishedAt,
        correct: a.correct,
        score: a.score,
        time_ms: a.timeMs,
        flagged: a.flagged,
      })
      .eq('user_id', s.userId)
      .eq('day', day);
    if (!r.last.correct && r.last.answer)
      await recordMistakes(s.userId, [{ qid: r.last.qid, chosen: r.last.answer }], 'daily');
    if (a.finishedAt && !a.flagged) await awardXp(s.userId, XP_FOR_DAILY, 'quest', `daily:${day}`);
  }
  return stepOf(r.attempt, !s, last);
}
