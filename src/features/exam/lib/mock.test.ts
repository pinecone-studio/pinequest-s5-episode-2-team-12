import { describe, expect, test } from 'bun:test';
import { placementPool, stopPool } from '@/features/roadmap/content/bank';
import { seeded } from '@/features/roadmap/lib/select-problems';
import type { Domain, Question } from '@/types';
import { MOCK } from '../config';
import {
  buildModule,
  compareAttempts,
  domainScores,
  estimateScore,
  finishAttempt,
  gradeModule,
  looksImpossible,
  type MockAnswer,
  type MockAttempt,
  routeFor,
  toPublic,
} from './mock';

const POOL: Question[] = [...stopPool(undefined, true), ...placementPool(true)];
const BANK = new Map(POOL.map((q) => [q.id, q]));
const right = (q: Question) => (typeof q.answer === 'number' ? String(q.answer) : q.answer[0]);

describe('buildModule', () => {
  test('22 distinct questions with the SAT domain split', () => {
    const ids = buildModule({ pool: POOL, mix: MOCK.mix.module1, rng: seeded(1) });
    expect(ids).toHaveLength(MOCK.questionsPerModule);
    expect(new Set(ids).size).toBe(ids.length);
    const by: Record<string, number> = {};
    for (const id of ids) {
      const d = BANK.get(id)!.domain;
      by[d] = (by[d] ?? 0) + 1;
    }
    expect(by).toEqual(MOCK.domainCounts);
  });

  test('the hard route is harder than the easy route', () => {
    const avg = (ids: string[]) => ids.reduce((s, id) => s + BANK.get(id)!.difficulty, 0) / ids.length;
    const hard = buildModule({ pool: POOL, mix: MOCK.mix.hard, rng: seeded(2) });
    const easy = buildModule({ pool: POOL, mix: MOCK.mix.easy, rng: seeded(2) });
    expect(avg(hard)).toBeGreaterThan(avg(easy) + 0.5);
  });

  test('module 2 never repeats module 1, and unseen questions come first', () => {
    const m1 = buildModule({ pool: POOL, mix: MOCK.mix.module1, rng: seeded(3) });
    const m2 = buildModule({ pool: POOL, mix: MOCK.mix.hard, exclude: new Set(m1), rng: seeded(4) });
    expect(m2.some((id) => m1.includes(id))).toBe(false);
    const seen = new Set(
      POOL.filter((q) => q.domain === 'geo')
        .slice(0, 5)
        .map((q) => q.id),
    );
    const next = buildModule({ pool: POOL, mix: MOCK.mix.module1, seen, rng: seeded(5) });
    expect(next.some((id) => seen.has(id))).toBe(false);
  });

  test('domains are interleaved, not blocked', () => {
    const ids = buildModule({ pool: POOL, mix: MOCK.mix.module1, rng: seeded(6) });
    const first4 = new Set(ids.slice(0, 4).map((id) => BANK.get(id)!.domain));
    expect(first4.size).toBe(4);
  });

  test('public questions carry no answer or explanation', () => {
    const q = toPublic(POOL[0]) as Record<string, unknown>;
    for (const k of ['answer', 'explain', 'hint', 'desmos', 'why']) expect(k in q).toBe(false);
  });
});

describe('grading and the estimate', () => {
  const m1 = buildModule({ pool: POOL, mix: MOCK.mix.module1, rng: seeded(7) });

  test('gradeModule re-checks answers on the server; missing answers are wrong', () => {
    const sub = m1.slice(0, 10).map((qid) => ({ qid, answer: right(BANK.get(qid)!), timeMs: 40_000 }));
    const graded = gradeModule(m1, sub, BANK);
    expect(graded).toHaveLength(22);
    expect(graded.filter((a) => a.correct)).toHaveLength(10);
    expect(graded[21]).toMatchObject({ answer: '', correct: false, timeMs: 0 });
  });

  test('route: 13+ correct in module 1 → hard', () => {
    expect(routeFor(13)).toBe('hard');
    expect(routeFor(12)).toBe('easy');
  });

  test('estimate: 200 for nothing, 800 for a perfect hard-route form, easy route caps lower', () => {
    const all = (ids: string[], correct: boolean): MockAnswer[] =>
      ids.map((qid) => ({ qid, answer: correct ? 'x' : '', correct, timeMs: 30_000 }));
    const m2hard = buildModule({ pool: POOL, mix: MOCK.mix.hard, exclude: new Set(m1), rng: seeded(8) });
    const m2easy = buildModule({ pool: POOL, mix: MOCK.mix.easy, exclude: new Set(m1), rng: seeded(8) });
    expect(estimateScore(all([...m1, ...m2hard], false), BANK)).toBe(200);
    expect(estimateScore(all([...m1, ...m2hard], true), BANK)).toBe(800);
    const easyMax = estimateScore(all([...m1, ...m2easy], true), BANK);
    expect(easyMax).toBeLessThan(760);
    expect(easyMax % 10).toBe(0);
  });

  test('domain scores and impossible timing', () => {
    const graded = gradeModule(
      m1,
      m1.map((qid) => ({ qid, answer: right(BANK.get(qid)!), timeMs: 900 })),
      BANK,
    );
    const d = domainScores(graded, BANK);
    expect(d.alg).toEqual({ correct: 8, total: 8 });
    expect(looksImpossible(graded)).toBe(true);
    expect(looksImpossible(graded.map((a) => ({ ...a, timeMs: 60_000 })))).toBe(false);
  });
});

describe('compareAttempts', () => {
  const ids = buildModule({ pool: POOL, mix: MOCK.mix.module1, rng: seeded(9) });
  const attempt = (correctOn: (q: Question) => boolean): MockAttempt => {
    const start = '2026-10-01T00:00:00.000Z';
    const answers = ids.map((qid) => {
      const ok = correctOn(BANK.get(qid)!);
      return { qid, answer: ok ? 'x' : 'y', correct: ok, timeMs: 60_000 };
    });
    const base: MockAttempt = {
      id: 'a',
      startedAt: start,
      finishedAt: null,
      route: 'easy',
      modules: [
        {
          no: 1,
          ids,
          answers,
          startedAt: start,
          endsAt: '2026-10-01T00:35:00.000Z',
          submittedAt: '2026-10-01T00:30:00.000Z',
        },
      ],
      score: null,
      raw: { correct: 0, total: 0 },
      domains: {} as Record<Domain, { correct: number; total: number }>,
      timeUsedSec: 0,
      flagged: false,
    };
    return finishAttempt(base, BANK, '2026-10-01T00:30:00.000Z');
  };

  test('score and domain deltas; improved and worse topics', () => {
    const before = attempt((q) => q.domain === 'alg');
    const after = attempt((q) => q.domain === 'adv');
    const c = compareAttempts(after, before, (id) => BANK.get(id)?.topicId);
    expect(c.domainDeltas.alg).toBe(-1);
    expect(c.domainDeltas.adv).toBe(1);
    expect(c.scoreDelta).toBe((after.score ?? 0) - (before.score ?? 0));
    expect(
      c.improved.every(
        (t) => BANK.get(ids.find((id) => BANK.get(id)!.topicId === t.topicId)!)!.domain === 'adv',
      ),
    ).toBe(true);
    expect(c.worse.length).toBeGreaterThan(0);
    expect(after.timeUsedSec).toBe(30 * 60);
  });

  test('comparing an attempt with itself changes nothing', () => {
    const a = attempt((q) => q.difficulty < 3);
    const c = compareAttempts(a, a, (id) => BANK.get(id)?.topicId);
    expect(c.scoreDelta).toBe(0);
    expect(c.improved).toEqual([]);
    expect(c.worse).toEqual([]);
  });
});
