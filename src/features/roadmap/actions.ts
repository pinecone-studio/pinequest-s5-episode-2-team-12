'use server';
// Section A · roadmap writes. The browser sends raw answers; the server re-grades them against the stored
// questions (lib/submit.ts), then writes with the service-role client: progress, attempts, XP, badges.
// Demo mode (no Supabase) returns { ok: false, reason: 'demo_mode' } and the client stores locally.
import { revalidatePath } from 'next/cache';
import { EARN } from '@/features/shop/catalog';
import { routes } from '@/lib/routes';
import { getDb } from '@/lib/supabase/server';
import { getAdminDb } from '@/server/db';
import { afterStudy, awardGems } from '@/server/gems';
import { recordMistakes } from '@/server/mistakes';
import { awardBadges, awardXp } from '@/server/xp';
import { ROADMAP } from './config';
import { progressRow, stopRow } from './lib/db-map';
import { skippedResult } from './lib/placement';
import { initialState, withAttempt, withPlacement } from './lib/state';
import { gradePlacementSubmission, gradeStopSubmission, type SubmittedAnswer } from './lib/submit';
import { getRoadmap, listPlacementQuestions, listStopQuestions } from './queries';
import type { PlacementResult, ProblemAttempt, RoadmapState } from './types';

type Reason =
  | 'demo_mode'
  | 'unauthorized'
  | 'invalid_input'
  | 'locked'
  | 'placement_unavailable'
  | 'database_error';
export type Fail = { ok: false; reason: Reason };

async function session(): Promise<
  { userId: string; admin: NonNullable<ReturnType<typeof getAdminDb>> } | Fail
> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return { ok: false, reason: 'unauthorized' };
  const admin = getAdminDb();
  if (!admin) return { ok: false, reason: 'database_error' };
  return { userId: user.id, admin };
}

function isAnswers(x: unknown, max = 40): x is SubmittedAnswer[] {
  return (
    Array.isArray(x) &&
    x.length <= max &&
    x.every(
      (a) =>
        a &&
        typeof a.qid === 'string' &&
        a.qid.length <= 40 &&
        typeof a.answer === 'string' &&
        typeof a.timeMs === 'number',
    )
  );
}

async function saveAttempts(
  admin: NonNullable<ReturnType<typeof getAdminDb>>,
  userId: string,
  attempts: ProblemAttempt[],
  answers: SubmittedAnswer[],
  context: 'placement' | 'stop' | 'testout',
  stopNo: number | null,
) {
  if (!attempts.length) return null;
  const { error } = await admin.from('problem_attempts').insert(
    attempts.map((a, i) => ({
      user_id: userId,
      question_id: a.qid,
      context,
      stop_no: stopNo,
      topic_id: a.topicId || null,
      answer: answers[i]?.answer.slice(0, 40) ?? '',
      correct: a.correct,
      time_ms: a.timeMs,
      hint_used: a.hintUsed,
      at: new Date(a.at).toISOString(),
    })),
  );
  await recordMistakes(
    userId,
    attempts.flatMap((a, i) => (a.correct ? [] : [{ qid: a.qid, chosen: answers[i]?.answer ?? '' }])),
    context,
  );
  return error;
}

async function saveState(admin: NonNullable<ReturnType<typeof getAdminDb>>, userId: string, s: RoadmapState) {
  const { error } = await admin
    .from('roadmap_progress')
    .upsert(progressRow(userId, s), { onConflict: 'user_id' });
  return error;
}

export async function skipPlacement(): Promise<{ ok: true; result: PlacementResult } | Fail> {
  const s = await session();
  if ('ok' in s) return s;
  const state = (await getRoadmap(s.userId)) ?? initialState();
  // skipping after a real test changes nothing
  if (state.placement && !state.placement.skipped) return { ok: true, result: state.placement };
  const result = skippedResult();
  const { error } = await s.admin.from('placement_attempts').insert({
    user_id: s.userId,
    skipped: true,
    level: result.level,
    mastery: result.mastery,
    finished_at: result.finishedAt,
  });
  if (error || (await saveState(s.admin, s.userId, withPlacement(state, result)))) {
    return { ok: false, reason: 'database_error' };
  }
  revalidatePath(routes.home);
  return { ok: true, result };
}

export async function submitPlacement(input: {
  answers: SubmittedAnswer[];
  startedAt?: string;
}): Promise<{ ok: true; result: PlacementResult; xp: number } | Fail> {
  const s = await session();
  if ('ok' in s) return s;
  if (!isAnswers(input?.answers, 26)) return { ok: false, reason: 'invalid_input' };

  const graded = gradePlacementSubmission(await listPlacementQuestions(), input.answers);
  if ('error' in graded) return { ok: false, reason: graded.error as Reason };
  const state = (await getRoadmap(s.userId)) ?? initialState();
  const next = withPlacement(state, graded.result);

  const { data: row, error } = await s.admin
    .from('placement_attempts')
    .insert({
      user_id: s.userId,
      skipped: false,
      module2: graded.result.module2,
      answers: graded.result.answers,
      score: graded.result.score,
      level: graded.result.level,
      mastery: graded.result.mastery,
      started_at: input.startedAt && Number.isFinite(Date.parse(input.startedAt)) ? input.startedAt : null,
      finished_at: graded.result.finishedAt,
    })
    .select('id')
    .single();
  if (error || !row) return { ok: false, reason: 'database_error' };
  if (
    (await saveState(s.admin, s.userId, next)) ||
    (await saveAttempts(s.admin, s.userId, graded.attempts, input.answers, 'placement', null))
  ) {
    return { ok: false, reason: 'database_error' };
  }
  const xp = await awardXp(s.userId, ROADMAP.xp.placement, 'placement', `placement:${row.id}`);
  revalidatePath(routes.home);
  return { ok: true, result: graded.result, xp: xp.ok && xp.awarded ? ROADMAP.xp.placement : 0 };
}

export type StopOutcome = {
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  testOut: boolean;
  correct: number;
  total: number;
  xp: number;
  badges: string[];
  finishedAll: boolean;
};

export async function submitStop(input: {
  no: number;
  testOut: boolean;
  answers: SubmittedAnswer[];
}): Promise<{ ok: true; outcome: StopOutcome } | Fail> {
  const s = await session();
  if ('ok' in s) return s;
  if (!Number.isInteger(input?.no) || input.no < 1 || input.no > 26 || !isAnswers(input.answers)) {
    return { ok: false, reason: 'invalid_input' };
  }
  const state = (await getRoadmap(s.userId)) ?? initialState();
  const graded = gradeStopSubmission(
    state,
    input.no,
    Boolean(input.testOut),
    await listStopQuestions(input.no),
    input.answers,
  );
  if ('error' in graded) return { ok: false, reason: graded.error as Reason };

  const out = withAttempt(state, input.no, graded.result, new Date().toISOString());
  const stop = out.state.stops.find((p) => p.no === input.no)!;
  const { error } = await s.admin
    .from('roadmap_stops')
    .upsert(stopRow(s.userId, stop), { onConflict: 'user_id,stop_no' });
  if (
    error ||
    (await saveState(s.admin, s.userId, out.state)) ||
    (await saveAttempts(
      s.admin,
      s.userId,
      graded.attempts,
      input.answers,
      input.testOut ? 'testout' : 'stop',
      input.no,
    ))
  ) {
    return { ok: false, reason: 'database_error' };
  }

  // the attempt number makes every award key unique and a double submit idempotent
  const key = `roadmap:stop:${input.no}:${stop.attempts}`;
  const xp = await awardXp(s.userId, out.xp, 'roadmap', key);
  const badges = await awardBadges(s.userId, out.badges);
  // gems: the first pass of a stop (with its stars), each new region badge, streak milestones
  if (graded.result.passed)
    await awardGems(s.userId, EARN.stopPass + EARN.perStar * graded.result.stars, 'stop', `stop:${input.no}`);
  for (const b of badges)
    if (b.startsWith('roadmap-') && b !== 'roadmap-final')
      await awardGems(s.userId, EARN.region, 'region', `region:${b}`);
  await afterStudy(s.userId);
  revalidatePath(routes.home);
  return {
    ok: true,
    outcome: {
      passed: graded.result.passed,
      stars: graded.result.stars,
      testOut: graded.result.testOut,
      correct: graded.correct,
      total: graded.total,
      xp: xp.ok && xp.awarded ? out.xp : 0,
      badges,
      finishedAll: out.finishedAll,
    },
  };
}
