'use server';
// Friends, safety (block / report) and duels. Signed in: Postgres via the service role, after the server
// checks the rules (friends only, not blocked, timing). Demo mode: the browser keeps the social state with the
// demo bots and sends it back; the server still grades duel answers.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mockBank } from '@/features/exam/engine';
import { type PublicQuestion, toPublic } from '@/features/exam/lib/mock';
import { getDb } from '@/lib/supabase/server';
import { getAdminDb } from '@/server/db';
import { recordMistakes } from '@/server/mistakes';
import { awardXp } from '@/server/xp';
import { botById, botRun as makeBotRun } from './lib/bots';
import { answerRun, type Duel, duelOutcome, createDuel as makeDuel, type Run, startRun } from './lib/duel';
import { pair, parseFriendCode, REACTIONS, REPORT_REASONS } from './lib/friends';
import { type DuelRow, duelFromRow, type RunRow, runFromRow } from './rows';

type Ok<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

async function me() {
  const db = await getDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const admin = getAdminDb();
  return user && admin ? { id: user.id, admin } : null;
}
type Me = NonNullable<Awaited<ReturnType<typeof me>>>;

async function isBlocked(m: Me, other: string) {
  const { data } = await m.admin
    .from('blocks')
    .select('blocker')
    .or(`and(blocker.eq.${m.id},blocked.eq.${other}),and(blocker.eq.${other},blocked.eq.${m.id})`)
    .limit(1);
  return (data ?? []).length > 0;
}

async function areFriends(m: Me, other: string) {
  const [a, b] = pair(m.id, other);
  const { data } = await m.admin
    .from('friendships')
    .select('status')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();
  return data?.status === 'accepted';
}

const Id = z.string().uuid();

// ———————————————————— friends ————————————————————

export async function addFriendByCode(code: string): Promise<Ok<{ name?: string }>> {
  const parsed = parseFriendCode(String(code ?? ''));
  if (!parsed) return { ok: false, reason: 'invalid_code' };
  const m = await me();
  if (!m) return { ok: false, reason: 'demo_mode' };
  const { data: other } = await m.admin
    .from('profiles')
    .select('id, name')
    .eq('friend_code', parsed)
    .maybeSingle();
  if (!other || other.id === m.id) return { ok: false, reason: 'not_found' };
  if (await isBlocked(m, other.id)) return { ok: false, reason: 'not_found' };
  const [a, b] = pair(m.id, other.id);
  const { data: existing } = await m.admin
    .from('friendships')
    .select('status, requested_by')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();
  if (existing?.status === 'accepted') return { ok: true, name: other.name };
  if (existing && existing.requested_by !== m.id) {
    // they asked first: adding them back accepts
    await m.admin
      .from('friendships')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('user_a', a)
      .eq('user_b', b);
  } else if (!existing) {
    await m.admin.from('friendships').insert({ user_a: a, user_b: b, requested_by: m.id });
  }
  revalidatePath('/friends');
  return { ok: true, name: other.name };
}

export async function respondFriend(otherId: string, accept: boolean): Promise<Ok> {
  if (!Id.safeParse(otherId).success) return { ok: false, reason: 'invalid_input' };
  const m = await me();
  if (!m) return { ok: false, reason: 'demo_mode' };
  const [a, b] = pair(m.id, otherId);
  const q = m.admin.from('friendships');
  const { error } = accept
    ? await q
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('user_a', a)
        .eq('user_b', b)
        .neq('requested_by', m.id)
    : await q.delete().eq('user_a', a).eq('user_b', b);
  revalidatePath('/friends');
  return error ? { ok: false, reason: 'database_error' } : { ok: true };
}

export async function removeFriend(otherId: string): Promise<Ok> {
  return respondFriend(otherId, false);
}

export async function blockUser(otherId: string): Promise<Ok> {
  if (!Id.safeParse(otherId).success) return { ok: false, reason: 'invalid_input' };
  const m = await me();
  if (!m) return { ok: false, reason: 'demo_mode' };
  const [a, b] = pair(m.id, otherId);
  await m.admin.from('friendships').delete().eq('user_a', a).eq('user_b', b);
  await m.admin.from('blocks').upsert({ blocker: m.id, blocked: otherId });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function unblockUser(otherId: string): Promise<Ok> {
  if (!Id.safeParse(otherId).success) return { ok: false, reason: 'invalid_input' };
  const m = await me();
  if (!m) return { ok: false, reason: 'demo_mode' };
  await m.admin.from('blocks').delete().eq('blocker', m.id).eq('blocked', otherId);
  revalidatePath('/', 'layout');
  return { ok: true };
}

const Report = z.object({
  target: z.string().min(1).max(64),
  context: z.enum(['profile', 'friend', 'leaderboard', 'duel', 'group']),
  reason: z.enum(REPORT_REASONS),
});

export async function reportUser(input: z.infer<typeof Report>): Promise<Ok> {
  const r = Report.safeParse(input);
  if (!r.success) return { ok: false, reason: 'invalid_input' };
  const m = await me();
  // demo reports have nobody to go to; the UI still confirms and hides the student
  if (!m || !Id.safeParse(r.data.target).success) return { ok: true };
  await m.admin.from('reports').insert({ reporter: m.id, ...r.data });
  return { ok: true };
}

// ———————————————————— duels ————————————————————

export type DuelStep = {
  duelId: string;
  index: number;
  total: number;
  question: PublicQuestion | null;
  finished: boolean;
  deadline: string;
  /** Demo only: the run the browser keeps. */
  run?: Run;
};

const Create = z.object({
  opponent: z.string().min(1).max(64),
  topicId: z.number().int().min(1).max(26).nullable(),
  size: z.union([z.literal(5), z.literal(10)]),
});

/**
 * Signed in: opponent must be an accepted friend and not blocked. Demo: returns the duel and the demo bot's
 * run for the browser to keep (the bot plays from the server, which has the answers).
 */
export async function createDuel(input: z.infer<typeof Create>): Promise<Ok<{ duel: Duel; botRun?: Run }>> {
  const c = Create.safeParse(input);
  if (!c.success) return { ok: false, reason: 'invalid_input' };
  const now = Date.now();
  const m = await me();
  if (!m) {
    const bot = botById(c.data.opponent);
    if (!bot) return { ok: false, reason: 'not_friends' };
    const duel = makeDuel({
      id: `local-${now.toString(36)}`,
      challenger: 'me',
      opponent: bot.id,
      topicId: c.data.topicId,
      size: c.data.size,
      pool: mockBank().pool,
      now,
    });
    const run = makeBotRun(bot, duel, mockBank().bank);
    // the browser keeps the bot's run: right/wrong and times only, never the answer text
    return { ok: true, duel, botRun: { ...run, answers: run.answers.map((a) => ({ ...a, answer: '' })) } };
  }
  if (
    !Id.safeParse(c.data.opponent).success ||
    !(await areFriends(m, c.data.opponent)) ||
    (await isBlocked(m, c.data.opponent))
  )
    return { ok: false, reason: 'not_friends' };
  const id = crypto.randomUUID();
  const duel = makeDuel({
    id,
    challenger: m.id,
    opponent: c.data.opponent,
    topicId: c.data.topicId,
    size: c.data.size,
    pool: mockBank().pool,
    now,
  });
  const { error } = await m.admin.from('duels').insert({
    id,
    challenger: m.id,
    opponent: c.data.opponent,
    topic_id: duel.topicId,
    size: duel.size,
    question_ids: duel.ids,
    time_limit_ms: duel.timeLimitMs,
    created_at: duel.createdAt,
    expires_at: duel.expiresAt,
  });
  revalidatePath('/friends');
  return error ? { ok: false, reason: 'database_error' } : { ok: true, duel };
}

function stepOf(duel: Duel, run: Run, demo: boolean): DuelStep {
  const q = !run.finishedAt ? mockBank().bank.get(duel.ids[run.answers.length]) : undefined;
  return {
    duelId: duel.id,
    index: run.answers.length,
    total: duel.ids.length,
    question: q ? toPublic(q) : null,
    finished: Boolean(run.finishedAt),
    deadline: new Date(Date.parse(run.startedAt) + duel.timeLimitMs).toISOString(),
    ...(demo && { run }),
  };
}

async function loadDuel(m: Me, id: string) {
  const { data } = await m.admin.from('duels').select('*').eq('id', id).maybeSingle();
  if (!data || (data.challenger !== m.id && data.opponent !== m.id)) return null;
  return duelFromRow(data as DuelRow);
}

/** Starts (or resumes) my run. The clock starts now, on the server. */
export async function startDuelRun(input: {
  duelId: string;
  duel?: Duel;
  run?: Run;
}): Promise<Ok<{ step: DuelStep }>> {
  const now = Date.now();
  const m = await me();
  if (!m) {
    if (!input.duel) return { ok: false, reason: 'not_found' };
    if (now > Date.parse(input.duel.expiresAt)) return { ok: false, reason: 'expired' };
    return { ok: true, step: stepOf(input.duel, input.run ?? startRun('me', now), true) };
  }
  if (!Id.safeParse(input.duelId).success) return { ok: false, reason: 'not_found' };
  const duel = await loadDuel(m, input.duelId);
  if (!duel) return { ok: false, reason: 'not_found' };
  const other = duel.challenger === m.id ? duel.opponent : duel.challenger;
  if (await isBlocked(m, other)) return { ok: false, reason: 'not_found' };
  const { data } = await m.admin
    .from('duel_runs')
    .select('*')
    .eq('duel_id', duel.id)
    .eq('user_id', m.id)
    .maybeSingle();
  if (data) return { ok: true, step: stepOf(duel, runFromRow(data as RunRow), false) };
  if (now > Date.parse(duel.expiresAt)) return { ok: false, reason: 'expired' };
  const run = startRun(m.id, now);
  await m.admin
    .from('duel_runs')
    .insert({ duel_id: duel.id, user_id: m.id, started_at: run.startedAt, served_at: run.servedAt });
  return { ok: true, step: stepOf(duel, run, false) };
}

/** One answer. No right/wrong feedback until both have finished (answers could be passed on). */
export async function answerDuel(input: {
  duelId: string;
  answer: string;
  duel?: Duel;
  run?: Run;
}): Promise<Ok<{ step: DuelStep }>> {
  const now = Date.now();
  const { bank } = mockBank();
  const m = await me();
  let duel: Duel | null = null;
  let run: Run | null = null;
  if (m) {
    if (!Id.safeParse(input.duelId).success) return { ok: false, reason: 'not_found' };
    duel = await loadDuel(m, input.duelId);
    const { data } = duel
      ? await m.admin.from('duel_runs').select('*').eq('duel_id', duel.id).eq('user_id', m.id).maybeSingle()
      : { data: null };
    run = data ? runFromRow(data as RunRow) : null;
  } else {
    duel = input.duel ?? null;
    run = input.run ?? null;
  }
  if (!duel || !run) return { ok: false, reason: 'not_found' };
  const r = answerRun(duel, run, String(input.answer ?? ''), bank, now);
  if ('error' in r) return { ok: false, reason: r.error };
  if (m) {
    await m.admin
      .from('duel_runs')
      .update({
        answers: r.run.answers,
        served_at: r.run.servedAt,
        finished_at: r.run.finishedAt,
        correct: r.run.correct,
        time_ms: r.run.timeMs,
        flagged: r.run.flagged,
      })
      .eq('duel_id', duel.id)
      .eq('user_id', m.id);
    if (r.run.finishedAt) {
      await recordMistakes(
        m.id,
        r.run.answers.filter((a) => a.answer && !a.correct).map((a) => ({ qid: a.qid, chosen: a.answer })),
        'duel',
      );
      if (!r.run.flagged) await awardXp(m.id, 15, 'practice', `duel:${duel.id}`);
    }
  }
  return { ok: true, step: stepOf(duel, r.run, !m) };
}

const React = z.object({ duelId: z.string().uuid(), code: z.enum(REACTIONS) });

/** A fixed reaction to the other player (no free text). */
export async function reactDuel(input: { duelId: string; code: string }): Promise<Ok> {
  const r = React.safeParse(input);
  const m = await me();
  if (!m || !r.success) return { ok: true }; // demo: the browser shows it locally
  const duel = await loadDuel(m, r.data.duelId);
  if (!duel) return { ok: false, reason: 'not_found' };
  const to = duel.challenger === m.id ? duel.opponent : duel.challenger;
  if (await isBlocked(m, to)) return { ok: false, reason: 'not_found' };
  await m.admin
    .from('reactions')
    .insert({ duel_id: duel.id, from_user: m.id, to_user: to, code: r.data.code });
  return { ok: true };
}

/** Full questions for a revealed duel only (both runs final, or the 24 hours are over). */
export async function duelReview(input: { duelId: string; duel?: Duel }) {
  const { bank } = mockBank();
  const m = await me();
  let duel: Duel | null = input.duel ?? null;
  if (m) {
    if (!Id.safeParse(input.duelId).success) return [];
    duel = await loadDuel(m, input.duelId);
    if (!duel) return [];
    const { data } = await m.admin.from('duel_runs').select('*').eq('duel_id', duel.id);
    const runs = (data ?? []).map((r) => runFromRow(r as RunRow));
    const mine = runs.find((r) => r.userId === m.id) ?? null;
    const theirs = runs.find((r) => r.userId !== m.id) ?? null;
    if (!duelOutcome(duel, mine, theirs, Date.now()).reveal) return [];
  }
  return (duel?.ids ?? [])
    .slice(0, 10)
    .map((id) => bank.get(id))
    .filter((q) => q !== undefined);
}
