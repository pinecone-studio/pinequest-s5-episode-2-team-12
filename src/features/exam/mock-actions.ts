'use server';
// Mock exam steps. Signed in: the attempt lives on the exams row (service role) and the server clock decides
// the deadlines. Demo mode: the browser keeps the attempt and sends it back each step — the server still
// grades, but nothing is stored. The browser never gets answers while a module is open.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { EARN } from '@/features/shop/catalog';
import { routes } from '@/lib/routes';
import { getDb } from '@/lib/supabase/server';
import { getAdminDb } from '@/server/db';
import { afterStudy, awardGems } from '@/server/gems';
import { recordMistakes } from '@/server/mistakes';
import { awardXp } from '@/server/xp';
import type { Question } from '@/types';
import { MOCK } from './config';
import {
  beginModule2 as begin2,
  mockBank,
  publicQuestions,
  type Submitted,
  seenIds,
  startAttempt,
  submitModule as submitStep,
} from './engine';
import { formById } from './forms';
import type { MockAttempt, PublicQuestion } from './lib/mock';

export type ExamStep = {
  id: string;
  phase: 'module1' | 'break' | 'module2' | 'done';
  module?: { no: 1 | 2; startedAt: string; endsAt: string; questions: PublicQuestion[] };
  breakEndsAt?: string;
  /** Demo only: the attempt the browser must keep and send back. */
  attempt?: MockAttempt;
  late?: boolean;
};
export type StepResult = { ok: true; step: ExamStep } | { ok: false; reason: string };

const XP_FOR_MOCK = 60;

const Answers = z
  .array(
    z.object({
      qid: z.string().max(64),
      answer: z.string().max(40),
      timeMs: z.number().min(0).max(3_600_000),
    }),
  )
  .max(MOCK.questionsPerModule);

async function signedIn() {
  const db = await getDb();
  if (!db) return null;
  const {
    data: { user },
  } = await db.auth.getUser();
  const admin = getAdminDb();
  return user && admin ? { userId: user.id, admin } : null;
}

function stepOf(a: MockAttempt, demo: boolean, late?: boolean): ExamStep {
  const [m1, m2] = a.modules;
  const base = { id: a.id, late, ...(demo && { attempt: a }) };
  if (a.finishedAt) return { ...base, phase: 'done' };
  if (!m1.submittedAt)
    return {
      ...base,
      phase: 'module1',
      module: { no: 1, startedAt: m1.startedAt, endsAt: m1.endsAt, questions: publicQuestions(m1.ids) },
    };
  // a group's module 2 opens at the shared time; until then it is the break
  const begun = m2 && Date.parse(m2.endsAt) > Date.parse(m2.startedAt);
  if (m2 && begun && Date.now() >= Date.parse(m2.startedAt) - MOCK.graceMs)
    return {
      ...base,
      phase: 'module2',
      module: { no: 2, startedAt: m2.startedAt, endsAt: m2.endsAt, questions: publicQuestions(m2.ids) },
    };
  return {
    ...base,
    phase: 'break',
    breakEndsAt:
      a.groupId && m2
        ? m2.startedAt
        : new Date(Date.parse(m1.submittedAt) + MOCK.breakMinutes * 60_000).toISOString(),
  };
}

type Session = NonNullable<Awaited<ReturnType<typeof signedIn>>>;

async function loadRow(s: Session, id: string): Promise<MockAttempt | null> {
  const { data } = await s.admin
    .from('exams')
    .select('attempt')
    .eq('id', id)
    .eq('user_id', s.userId)
    .maybeSingle();
  return (data?.attempt as MockAttempt | undefined) ?? null;
}

async function saveRow(s: Session, a: MockAttempt) {
  const [m1, m2] = a.modules;
  const phase = a.finishedAt
    ? 'results'
    : !m1.submittedAt
      ? 'module1'
      : m2 && Date.parse(m2.endsAt) > Date.parse(m2.startedAt)
        ? 'module2'
        : 'break';
  const row = {
    attempt: a,
    phase,
    module: phase === 'module1' ? 1 : phase === 'module2' ? 2 : 0,
    ends_at: phase === 'module1' ? m1.endsAt : phase === 'module2' ? m2.endsAt : null,
    route: a.route,
    ...(a.finishedAt && {
      score: a.score,
      score_est: a.score,
      domain_scores: a.domains,
      time_used_sec: a.timeUsedSec,
      finished_at: a.finishedAt,
      flagged: a.flagged,
    }),
  };
  const { error } = await s.admin.from('exams').update(row).eq('id', a.id).eq('user_id', s.userId);
  return !error;
}

async function previousSeen(s: Session): Promise<Set<string>> {
  const { data } = await s.admin
    .from('exams')
    .select('attempt')
    .eq('user_id', s.userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(10);
  return seenIds((data ?? []).map((r) => r.attempt as MockAttempt).filter(Boolean));
}

/** Starts a mock: the random adaptive one, or the practice test `formId` (forms.ts). */
export async function startMock(input: { seen?: string[]; formId?: string } = {}): Promise<StepResult> {
  const now = Date.now();
  const formId = typeof input.formId === 'string' ? input.formId.slice(0, 32) : undefined;
  if (formId && !formById(formId)) return { ok: false, reason: 'not_found' };
  const s = await signedIn();
  if (!s) {
    const seen = new Set((input.seen ?? []).slice(0, 500));
    return {
      ok: true,
      step: stepOf(startAttempt(`local-${now.toString(36)}`, seen, now, undefined, formId), true),
    };
  }
  const id = crypto.randomUUID();
  const a = startAttempt(id, formId ? new Set() : await previousSeen(s), now, undefined, formId);
  const { error } = await s.admin.from('exams').insert({
    id,
    user_id: s.userId,
    kind: 'solo',
    phase: 'module1',
    module: 1,
    modules: [{ no: 1, questionIds: a.modules[0].ids, minutes: MOCK.moduleMinutes }],
    started_at: a.startedAt,
    ends_at: a.modules[0].endsAt,
    attempt: a,
  });
  return error ? { ok: false, reason: 'database_error' } : { ok: true, step: stepOf(a, false) };
}

export async function submitModule(input: {
  id: string;
  no: 1 | 2;
  answers: Submitted;
  /** Demo only. */
  attempt?: MockAttempt;
  seen?: string[];
}): Promise<StepResult> {
  const answers = Answers.safeParse(input.answers);
  if (!answers.success || (input.no !== 1 && input.no !== 2)) return { ok: false, reason: 'invalid_input' };
  const now = Date.now();
  const s = await signedIn();
  const current = s ? await loadRow(s, input.id) : (input.attempt ?? null);
  if (!current || current.id !== input.id) return { ok: false, reason: 'not_found' };
  const seen = s ? await previousSeen(s) : new Set((input.seen ?? []).slice(0, 500));
  const r = submitStep(current, input.no, answers.data, now, seen);
  if ('error' in r) return { ok: false, reason: r.error };
  if (s) {
    if (!(await saveRow(s, r.attempt))) return { ok: false, reason: 'database_error' };
    const graded = r.attempt.modules.find((m) => m.no === input.no)?.answers ?? [];
    // blanks are not mistakes the notebook can teach from; wrong answers are
    await recordMistakes(
      s.userId,
      graded.filter((a) => a.answer && !a.correct).map((a) => ({ qid: a.qid, chosen: a.answer })),
      'mock',
    );
    if (r.attempt.finishedAt && !r.attempt.flagged) {
      await awardXp(s.userId, XP_FOR_MOCK, 'exam', `mock:${r.attempt.id}`);
      await awardGems(s.userId, EARN.mock, 'mock', `mock:${r.attempt.id}`);
      await afterStudy(s.userId);
    }
    if (r.attempt.finishedAt) revalidatePath(routes.profile);
  }
  return { ok: true, step: stepOf(r.attempt, !s, r.late) };
}

export async function beginModule2(input: { id: string; attempt?: MockAttempt }): Promise<StepResult> {
  const s = await signedIn();
  const current = s ? await loadRow(s, input.id) : (input.attempt ?? null);
  if (!current || current.id !== input.id) return { ok: false, reason: 'not_found' };
  const r = begin2(current, Date.now());
  if ('error' in r) return { ok: false, reason: r.error };
  if (s && !(await saveRow(s, r.attempt))) return { ok: false, reason: 'database_error' };
  return { ok: true, step: stepOf(r.attempt, !s) };
}

/** Where an unfinished attempt stands (after a reload). Demo: from the attempt the browser kept. */
export async function viewMock(input: { id: string; attempt?: MockAttempt }): Promise<StepResult> {
  const s = await signedIn();
  const a = s ? await loadRow(s, input.id) : (input.attempt ?? null);
  if (!a || a.id !== input.id) return { ok: false, reason: 'not_found' };
  return { ok: true, step: stepOf(a, !s) };
}

/**
 * Full questions (answers, explanations) for reviewing a finished attempt. Signed in: only for the student's
 * own finished attempt. Demo: for the ids the browser sends.
 */
export async function reviewQuestions(input: { id: string; ids?: string[] }): Promise<Question[]> {
  const { bank } = mockBank();
  const s = await signedIn();
  let ids: string[] = [];
  if (s) {
    const a = await loadRow(s, input.id);
    if (!a?.finishedAt) return [];
    ids = a.modules.flatMap((m) => m.ids);
  } else ids = (input.ids ?? []).slice(0, MOCK.questionsPerModule * 2 * 2);
  return ids.map((id) => bank.get(id)).filter((q): q is Question => Boolean(q));
}
