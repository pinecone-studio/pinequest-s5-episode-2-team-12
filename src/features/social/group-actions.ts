'use server';
// Group mock exam: schedule, invite friends, join, take it on the shared clock, and the board after the window
// closes. Signed in only (other students are real accounts); demo mode simulates it in the browser.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { MOCK } from '@/features/exam/config';
import { mockBank, startGroupAttempt } from '@/features/exam/engine';
import { getDb } from '@/lib/supabase/server';
import { getAdminDb } from '@/server/db';
import { pair } from './lib/friends';
import { GROUP, GROUP_WINDOW_MS, groupClock, groupState, makeGroupForm, startOk } from './lib/group';

type Ok<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

async function me() {
  const db = await getDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const admin = getAdminDb();
  return user && admin ? { id: user.id, admin } : null;
}

const Create = z.object({
  startsAt: z.string().datetime(),
  invite: z.array(z.string().uuid()).max(GROUP.maxMembers),
});

export async function createGroup(input: {
  startsAt: string;
  invite: string[];
}): Promise<Ok<{ id: string }>> {
  const c = Create.safeParse(input);
  if (!c.success) return { ok: false, reason: 'invalid_input' };
  const m = await me();
  if (!m) return { ok: false, reason: 'demo_mode' };
  const start = Date.parse(c.data.startsAt);
  if (!startOk(start, Date.now())) return { ok: false, reason: 'bad_time' };
  // only accepted friends can be invited
  const friends: string[] = [];
  for (const id of c.data.invite) {
    const [a, b] = pair(m.id, id);
    const { data } = await m.admin
      .from('friendships')
      .select('status')
      .eq('user_a', a)
      .eq('user_b', b)
      .maybeSingle();
    if (data?.status === 'accepted') friends.push(id);
  }
  const form = makeGroupForm(mockBank().pool, start);
  const { data, error } = await m.admin
    .from('group_sessions')
    .insert({
      host: m.id,
      starts_at: new Date(start).toISOString(),
      closes_at: new Date(start + GROUP_WINDOW_MS).toISOString(),
      module1: form.module1,
      module2: form.module2,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, reason: 'database_error' };
  await m.admin
    .from('group_members')
    .insert([
      { session_id: data.id, user_id: m.id, invited_by: m.id, joined_at: new Date().toISOString() },
      ...friends.map((f) => ({ session_id: data.id, user_id: f, invited_by: m.id })),
    ]);
  revalidatePath('/friends');
  return { ok: true, id: data.id };
}

export async function joinGroup(sessionId: string): Promise<Ok> {
  if (!z.string().uuid().safeParse(sessionId).success) return { ok: false, reason: 'invalid_input' };
  const m = await me();
  if (!m) return { ok: false, reason: 'demo_mode' };
  const { error } = await m.admin
    .from('group_members')
    .update({ joined_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', m.id);
  revalidatePath(`/group/${sessionId}`);
  return error ? { ok: false, reason: 'database_error' } : { ok: true };
}

/** Starts (or resumes) the group mock for an invited member while the window is open. */
export async function startGroupMock(sessionId: string): Promise<Ok<{ attemptId: string }>> {
  if (!z.string().uuid().safeParse(sessionId).success) return { ok: false, reason: 'invalid_input' };
  const m = await me();
  if (!m) return { ok: false, reason: 'demo_mode' };
  const { data: s } = await m.admin.from('group_sessions').select('*').eq('id', sessionId).maybeSingle();
  const { data: member } = await m.admin
    .from('group_members')
    .select('user_id')
    .eq('session_id', sessionId)
    .eq('user_id', m.id)
    .maybeSingle();
  if (!s || !member) return { ok: false, reason: 'not_found' };
  const now = Date.now();
  if (groupState({ startsAt: s.starts_at, closesAt: s.closes_at }, now) !== 'open')
    return { ok: false, reason: 'not_open' };
  const { data: existing } = await m.admin
    .from('exams')
    .select('id')
    .eq('user_id', m.id)
    .eq('group_session_id', sessionId)
    .maybeSingle();
  if (existing) return { ok: true, attemptId: existing.id };
  const id = crypto.randomUUID();
  const a = startGroupAttempt(
    id,
    sessionId,
    { module1: s.module1, module2: s.module2 },
    groupClock(s.starts_at),
    now,
  );
  const { error } = await m.admin.from('exams').insert({
    id,
    user_id: m.id,
    kind: 'group',
    group_session_id: sessionId,
    phase: 'module1',
    module: 1,
    modules: [{ no: 1, questionIds: a.modules[0].ids, minutes: MOCK.moduleMinutes }],
    started_at: a.startedAt,
    ends_at: a.modules[0].endsAt,
    attempt: a,
  });
  await m.admin
    .from('group_members')
    .update({ joined_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', m.id)
    .is('joined_at', null);
  return error ? { ok: false, reason: 'database_error' } : { ok: true, attemptId: id };
}
