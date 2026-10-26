import { describe, expect, test } from 'bun:test';
import { mockBank } from '@/features/exam/engine';
import { seeded } from '@/features/roadmap/lib/select-problems';
import { BOTS, botRun } from './bots';
import { answerRun, createDuel, DUEL, duelOutcome, type Run, startRun } from './duel';
import { formatFriendCode, makeFriendCode, pair, parseFriendCode, visible } from './friends';
import { GROUP_WINDOW_MS, groupClock, groupState, makeGroupForm, startOk } from './group';
import { type Candidate, leaderboard } from './ranking';

const { pool, bank } = mockBank();
const T0 = Date.parse('2026-10-26T01:00:00Z');
const right = (qid: string) => {
  const q = bank.get(qid)!;
  return typeof q.answer === 'number' ? String(q.answer) : q.answer[0];
};
const pub = { hidePublic: false, friendsOnly: false };

describe('friends', () => {
  test('codes avoid look-alike characters and parse what students type', () => {
    const code = makeFriendCode(seeded(1));
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(parseFriendCode(formatFriendCode(code).toLowerCase())).toBe(code);
    expect(parseFriendCode('ABCD-EF01')).toBeNull(); // 0 and 1 are not in the alphabet
    expect(parseFriendCode('ABC')).toBeNull();
  });

  test('a pair is stored once, smaller id first', () => {
    expect(pair('b', 'a')).toEqual(['a', 'b']);
  });

  test('visibility: blocks hide everywhere, friends-only and hide-public settings', () => {
    const none = { friends: false, blocked: false };
    const friend = { friends: true, blocked: false };
    expect(visible('national', pub, none, false)).toBe(true);
    expect(visible('national', { ...pub, hidePublic: true }, none, false)).toBe(false);
    expect(visible('national', { ...pub, friendsOnly: true }, none, false)).toBe(false);
    expect(visible('national', { ...pub, friendsOnly: true }, friend, false)).toBe(true);
    expect(visible('friends', pub, none, false)).toBe(false);
    expect(visible('friends', pub, { friends: true, blocked: true }, false)).toBe(false);
    expect(visible('national', { hidePublic: true, friendsOnly: true }, none, true)).toBe(true); // yourself
  });
});

describe('duels', () => {
  const duel = createDuel({
    id: 'd1',
    challenger: 'a',
    opponent: 'b',
    topicId: null,
    size: 5,
    pool,
    now: T0,
    seed: 42,
  });

  test('both get the same frozen questions; topic duels stay on topic', () => {
    expect(duel.ids).toHaveLength(5);
    expect(new Set(duel.ids).size).toBe(5);
    expect(duel.timeLimitMs).toBe(5 * DUEL.msPerQuestion);
    const topical = createDuel({
      id: 'd2',
      challenger: 'a',
      opponent: 'b',
      topicId: 9,
      size: 5,
      pool,
      now: T0,
      seed: 1,
    });
    expect(topical.ids.every((id) => bank.get(id)?.topicId === 9)).toBe(true);
  });

  const play = (userId: string, ok: (i: number) => boolean, msEach: number): Run => {
    let run = startRun(userId, T0);
    let t = T0;
    duel.ids.forEach((qid, i) => {
      t += msEach;
      const r = answerRun(duel, run, ok(i) ? right(qid) : '', bank, t);
      if ('error' in r) throw new Error(r.error);
      run = r.run;
    });
    return run;
  };

  test('results stay hidden until both finish; more correct wins, then less time', () => {
    const a = play('a', () => true, 20_000);
    expect(duelOutcome(duel, a, null, T0 + 3_600_000)).toMatchObject({ status: 'waiting', reveal: false });
    const b = play('b', (i) => i < 4, 10_000);
    expect(duelOutcome(duel, a, b, T0 + 3_600_000)).toMatchObject({
      status: 'done',
      reveal: true,
      winner: 'a',
    });
    const c = play('b', () => true, 10_000);
    expect(duelOutcome(duel, a, c, T0 + 3_600_000).winner).toBe('b'); // same score, faster
    expect(duelOutcome(duel, a, { ...a, userId: 'b' }, T0 + 3_600_000).winner).toBe('draw');
  });

  test('after 24 hours the finisher wins by forfeit; flagged runs never win', () => {
    const a = play('a', (i) => i < 2, 20_000);
    const late = T0 + DUEL.openMs + 1;
    expect(duelOutcome(duel, a, null, late)).toMatchObject({
      status: 'expired',
      reveal: true,
      winner: 'a',
      forfeit: true,
    });
    const cheat = play('b', () => true, 500);
    expect(cheat.flagged).toBe(true);
    expect(duelOutcome(duel, a, cheat, T0 + 3_600_000)).toMatchObject({ winner: 'a', forfeit: true });
    expect(answerRun(duel, startRun('x', T0), '1', bank, late)).toEqual({ error: 'expired' });
  });

  test('answers past the time limit do not count', () => {
    let run = startRun('a', T0);
    const r = answerRun(duel, run, right(duel.ids[0]), bank, T0 + duel.timeLimitMs + DUEL.graceMs + 1);
    if ('error' in r) throw new Error(r.error);
    run = r.run;
    expect(r.last.correct).toBe(false);
    expect(run.finishedAt).not.toBeNull();
  });

  test('demo bots play deterministically', () => {
    const r1 = botRun(BOTS[0], duel, bank);
    expect(botRun(BOTS[0], duel, bank)).toEqual(r1);
    expect(r1.finishedAt).not.toBeNull();
    expect(r1.answers).toHaveLength(5);
  });
});

describe('group mock', () => {
  test('one frozen form, a shared clock, scheduled → open → closed', () => {
    const f = makeGroupForm(pool, 7);
    expect(f.module1).toHaveLength(22);
    expect(f.module2).toHaveLength(22);
    expect(f.module2.some((id) => f.module1.includes(id))).toBe(false);
    expect(makeGroupForm(pool, 7)).toEqual(f);
    const startsAt = new Date(T0).toISOString();
    const closesAt = new Date(T0 + GROUP_WINDOW_MS).toISOString();
    expect(groupState({ startsAt, closesAt }, T0 - 1)).toBe('scheduled');
    expect(groupState({ startsAt, closesAt }, T0 + 1)).toBe('open');
    expect(groupState({ startsAt, closesAt }, T0 + GROUP_WINDOW_MS)).toBe('closed');
    const clock = groupClock(startsAt);
    expect(Date.parse(clock.module2.startedAt) - T0).toBe(45 * 60_000);
    expect(startOk(T0 + 10 * 60_000, T0)).toBe(true);
    expect(startOk(T0 + 60_000, T0)).toBe(false);
  });
});

describe('leaderboard ranking', () => {
  const c = (userId: string, value: number | null, extra: Partial<Candidate> = {}): Candidate => ({
    userId,
    name: userId,
    level: 1,
    privacy: pub,
    value,
    aimag: 'Төв',
    ...extra,
  });
  const none = () => ({ friends: false, blocked: false });

  test('ties share a place (1, 2, 2, 4) and time breaks equal values', () => {
    const rows = leaderboard(
      [c('a', 300), c('b', 200), c('c', 200), c('d', 100)],
      { userId: 'a' },
      'national',
      none,
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    const timed = leaderboard(
      [c('a', 200, { timeMs: 9 }), c('b', 200, { timeMs: 5 })],
      { userId: 'a' },
      'national',
      none,
    );
    expect(timed.map((r) => r.userId)).toEqual(['b', 'a']);
  });

  test('flagged attempts, blocked and hidden students are left out; aimag scope matches the viewer', () => {
    const rows = leaderboard(
      [
        c('me', 50),
        c('cheat', 999, { flagged: true }),
        c('hidden', 400, { privacy: { hidePublic: true, friendsOnly: false } }),
        c('blocked', 300),
        c('far', 200, { aimag: 'Увс' }),
        c('none', null),
      ],
      { userId: 'me', aimag: 'Төв' },
      'aimag',
      (id) => ({ friends: false, blocked: id === 'blocked' }),
    );
    expect(rows.map((r) => r.userId)).toEqual(['me']);
    expect(rows[0]).toMatchObject({ rank: 1, me: true });
  });

  test('friends scope lists only friends (and me)', () => {
    const rows = leaderboard([c('me', 10), c('f', 20), c('x', 30)], { userId: 'me' }, 'friends', (id) => ({
      friends: id === 'f',
      blocked: false,
    }));
    expect(rows.map((r) => r.userId)).toEqual(['f', 'me']);
  });
});
