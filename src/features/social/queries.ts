// Signed-in social reads (service role, scoped to the student). Others appear only as public profiles:
// name, avatar, level — and, for accepted friends, their streak.
import { statsFromXp } from '@/features/progress/lib/stats';
import { calculateLevel } from '@/lib/level';
import { getAdminDb } from '@/server/db';
import type { Duel, DuelOutcome, Run } from './lib/duel';
import { duelOutcome } from './lib/duel';
import type { Metric, Row, Scope } from './lib/ranking';
import { type DuelRow, duelFromRow, type RunRow, runFromRow } from './rows';

export type PublicUser = { id: string; name: string; avatarId?: string; level: number; streak?: number };
export type DuelSummary = {
  duel: Duel;
  opponent: PublicUser;
  mine: Pick<Run, 'finishedAt' | 'correct' | 'timeMs'> | null;
  theirs: Pick<Run, 'finishedAt' | 'correct' | 'timeMs'> | null;
  outcome: DuelOutcome;
  /** From my side, once revealed. */
  result: 'won' | 'lost' | 'draw' | null;
};
export type GroupSummary = {
  id: string;
  host: string;
  startsAt: string;
  closesAt: string;
  members: PublicUser[];
  joined: boolean;
};
export type SocialOverview = {
  code: string;
  friends: PublicUser[];
  incoming: PublicUser[];
  outgoing: PublicUser[];
  blocked: PublicUser[];
  duels: DuelSummary[];
  groups: GroupSummary[];
};

type Admin = NonNullable<ReturnType<typeof getAdminDb>>;

async function publicUsers(
  admin: Admin,
  ids: string[],
  withStreak = false,
): Promise<Map<string, PublicUser>> {
  const out = new Map<string, PublicUser>();
  if (!ids.length) return out;
  const { data } = await admin.from('public_profiles').select('id, name, avatar_id, xp').in('id', ids);
  for (const r of data ?? [])
    out.set(r.id, {
      id: r.id,
      name: r.name,
      avatarId: r.avatar_id ?? undefined,
      level: calculateLevel(Number(r.xp)).level,
    });
  if (withStreak) {
    const { data: xp } = await admin
      .from('xp_events')
      .select('user_id, amount, at')
      .in('user_id', ids)
      .limit(20000);
    for (const id of ids) {
      const u = out.get(id);
      if (u) u.streak = statsFromXp((xp ?? []).filter((x) => x.user_id === id)).streak;
    }
  }
  return out;
}

const brief = (r: Run | null) =>
  r ? { finishedAt: r.finishedAt, correct: r.correct, timeMs: r.timeMs } : null;

export async function socialOverview(userId: string): Promise<SocialOverview | null> {
  const admin = getAdminDb();
  if (!admin) return null;
  const [prof, fr, bl, du, gm] = await Promise.all([
    admin.from('profiles').select('friend_code').eq('id', userId).maybeSingle(),
    admin.from('friendships').select('*').or(`user_a.eq.${userId},user_b.eq.${userId}`),
    admin.from('blocks').select('blocked').eq('blocker', userId),
    admin
      .from('duels')
      .select('*')
      .or(`challenger.eq.${userId},opponent.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('group_members').select('session_id, joined_at').eq('user_id', userId),
  ]);
  const other = (f: { user_a: string; user_b: string }) => (f.user_a === userId ? f.user_b : f.user_a);
  const rows = fr.data ?? [];
  const acceptedIds = rows.filter((f) => f.status === 'accepted').map(other);
  const incomingIds = rows.filter((f) => f.status === 'pending' && f.requested_by !== userId).map(other);
  const outgoingIds = rows.filter((f) => f.status === 'pending' && f.requested_by === userId).map(other);
  const blockedIds = (bl.data ?? []).map((b) => b.blocked);
  const duels = (du.data ?? []).map((d) => duelFromRow(d as DuelRow));
  const duelOther = duels.map((d) => (d.challenger === userId ? d.opponent : d.challenger));

  const { data: runs } = duels.length
    ? await admin
        .from('duel_runs')
        .select('*')
        .in(
          'duel_id',
          duels.map((d) => d.id),
        )
    : { data: [] };
  const sessionIds = (gm.data ?? []).map((g) => g.session_id);
  const { data: hosted } = await admin.from('group_sessions').select('id').eq('host', userId);
  const allSessions = [...new Set([...sessionIds, ...(hosted ?? []).map((h) => h.id)])];
  const { data: sessions } = allSessions.length
    ? await admin.from('group_sessions').select('*').in('id', allSessions)
    : { data: [] };
  const { data: members } = allSessions.length
    ? await admin.from('group_members').select('*').in('session_id', allSessions)
    : { data: [] };

  const users = await publicUsers(admin, [
    ...new Set([
      ...acceptedIds,
      ...incomingIds,
      ...outgoingIds,
      ...blockedIds,
      ...duelOther,
      ...(members ?? []).map((m) => m.user_id),
    ]),
  ]);
  const friends = await publicUsers(admin, acceptedIds, true);
  const pick = (ids: string[]) => ids.map((id) => users.get(id)).filter((u): u is PublicUser => Boolean(u));
  const now = Date.now();

  return {
    code: prof.data?.friend_code ?? '',
    friends: acceptedIds.map((id) => friends.get(id)).filter((u): u is PublicUser => Boolean(u)),
    incoming: pick(incomingIds),
    outgoing: pick(outgoingIds),
    blocked: pick(blockedIds),
    duels: duels
      .filter((d) => !blockedIds.includes(d.challenger === userId ? d.opponent : d.challenger))
      .map((d) => {
        const rs = (runs ?? []).filter((r) => r.duel_id === d.id).map((r) => runFromRow(r as RunRow));
        const mine = rs.find((r) => r.userId === userId) ?? null;
        const theirs = rs.find((r) => r.userId !== userId) ?? null;
        const outcome = duelOutcome(d, mine, theirs, now);
        const oid = d.challenger === userId ? d.opponent : d.challenger;
        return {
          duel: d,
          opponent: users.get(oid) ?? { id: oid, name: '—', level: 1 },
          mine: brief(mine),
          // the other side's numbers only once results are revealed
          theirs: outcome.reveal
            ? brief(theirs)
            : theirs
              ? { finishedAt: theirs.finishedAt, correct: 0, timeMs: 0 }
              : null,
          outcome,
          result:
            !outcome.reveal || !outcome.winner
              ? null
              : outcome.winner === 'draw'
                ? 'draw'
                : outcome.winner === userId
                  ? 'won'
                  : 'lost',
        };
      }),
    groups: (sessions ?? []).map((s) => ({
      id: s.id,
      host: s.host,
      startsAt: s.starts_at,
      closesAt: s.closes_at,
      members: pick((members ?? []).filter((m) => m.session_id === s.id).map((m) => m.user_id)),
      joined:
        Boolean((members ?? []).find((m) => m.session_id === s.id && m.user_id === userId)?.joined_at) ||
        s.host === userId,
    })),
  };
}

export async function duelState(userId: string, duelId: string) {
  const admin = getAdminDb();
  if (!admin) return null;
  const { data } = await admin.from('duels').select('*').eq('id', duelId).maybeSingle();
  if (!data || (data.challenger !== userId && data.opponent !== userId)) return null;
  const duel = duelFromRow(data as DuelRow);
  const { data: runs } = await admin.from('duel_runs').select('*').eq('duel_id', duelId);
  const rs = (runs ?? []).map((r) => runFromRow(r as RunRow));
  const mine = rs.find((r) => r.userId === userId) ?? null;
  const theirs = rs.find((r) => r.userId !== userId) ?? null;
  const outcome = duelOutcome(duel, mine, theirs, Date.now());
  const oid = duel.challenger === userId ? duel.opponent : duel.challenger;
  const users = await publicUsers(admin, [oid]);
  return {
    duel,
    mine,
    theirs: outcome.reveal ? theirs : null,
    theirsFinished: Boolean(theirs?.finishedAt),
    outcome,
    opponent: users.get(oid) ?? { id: oid, name: '—', level: 1 },
  };
}

export async function leaderboardRows(scope: Scope, metric: Metric, userId: string): Promise<Row[]> {
  const admin = getAdminDb();
  const { getDb } = await import('@/lib/supabase/server');
  const db = await getDb();
  if (!admin || !db) return [];
  const { data, error } = await db.rpc('leaderboard', { p_scope: scope, p_metric: metric, p_limit: 50 });
  if (error) return [];
  return (data ?? []).map(
    (r: {
      rank: number;
      user_id: string;
      name: string;
      avatar_id: string | null;
      xp: number;
      value: number;
      me: boolean;
    }) => ({
      rank: Number(r.rank),
      userId: r.user_id,
      name: r.name,
      avatarId: r.avatar_id ?? undefined,
      level: calculateLevel(Number(r.xp)).level,
      value: Number(r.value),
      me: r.me || r.user_id === userId,
    }),
  );
}

export type GroupView = {
  id: string;
  host: string;
  startsAt: string;
  closesAt: string;
  members: (PublicUser & { joined: boolean })[];
  myAttemptId: string | null;
  /** After the window closes: members' estimated scores (flagged attempts left out). */
  board:
    | { userId: string; name: string; avatarId?: string; score: number; me: boolean; rank: number }[]
    | null;
};

export async function groupView(userId: string, sessionId: string): Promise<GroupView | null> {
  const admin = getAdminDb();
  if (!admin) return null;
  const { data: s } = await admin.from('group_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!s) return null;
  const { data: members } = await admin
    .from('group_members')
    .select('user_id, joined_at')
    .eq('session_id', sessionId);
  if (!(members ?? []).some((m) => m.user_id === userId)) return null;
  const { data: blocks } = await admin.from('blocks').select('blocked').eq('blocker', userId);
  const hidden = new Set((blocks ?? []).map((b) => b.blocked));
  const ids = (members ?? []).map((m) => m.user_id).filter((id) => !hidden.has(id));
  const users = await publicUsers(admin, ids);
  const { data: mine } = await admin
    .from('exams')
    .select('id')
    .eq('user_id', userId)
    .eq('group_session_id', sessionId)
    .maybeSingle();
  let board: GroupView['board'] = null;
  if (Date.now() >= Date.parse(s.closes_at)) {
    const { data: ex } = await admin
      .from('exams')
      .select('user_id, score_est, time_used_sec, flagged, finished_at')
      .eq('group_session_id', sessionId)
      .not('finished_at', 'is', null);
    const rows = (ex ?? [])
      .filter((e) => !e.flagged && ids.includes(e.user_id))
      .sort((a, b) => b.score_est - a.score_est || a.time_used_sec - b.time_used_sec);
    board = [];
    for (const [i, r] of rows.entries()) {
      const prev = rows[i - 1];
      const tied = prev && prev.score_est === r.score_est && prev.time_used_sec === r.time_used_sec;
      board.push({
        userId: r.user_id,
        name: users.get(r.user_id)?.name ?? '—',
        avatarId: users.get(r.user_id)?.avatarId,
        score: r.score_est,
        me: r.user_id === userId,
        rank: tied ? board[i - 1].rank : i + 1,
      });
    }
  }
  return {
    id: s.id,
    host: s.host,
    startsAt: s.starts_at,
    closesAt: s.closes_at,
    members: ids.map((id) => ({
      ...(users.get(id) ?? { id, name: '—', level: 1 }),
      joined: Boolean((members ?? []).find((m) => m.user_id === id)?.joined_at),
    })),
    myAttemptId: mine?.id ?? null,
    board,
  };
}
