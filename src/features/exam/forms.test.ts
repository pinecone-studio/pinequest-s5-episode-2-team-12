import { describe, expect, test } from 'bun:test';
import { checkPracticeTests } from '../../../scripts/mock/check-practice-tests';
import { MOCK } from './config';
import { beginModule2, mockBank, startAttempt, submitModule } from './engine';
import { availableForms, formById, PRACTICE_TESTS } from './forms';

const T0 = Date.parse('2026-10-28T01:00:00Z');
const MIN = 60_000;
const right = (qid: string) => {
  const q = mockBank().bank.get(qid)!;
  return typeof q.answer === 'number' ? String(q.answer) : q.answer[0];
};
const answer = (ids: string[], nRight: number) =>
  ids.map((qid, i) => ({ qid, answer: i < nRight ? right(qid) : '', timeMs: 60_000 }));

describe('practice tests', () => {
  test('content: schema, module shape and every numeric answer check out', () => {
    expect(checkPracticeTests()).toEqual([]);
  });

  test('practice-test questions are gradable but stay out of the random pool', () => {
    const { pool, bank } = mockBank();
    const poolIds = new Set(pool.map((q) => q.id));
    for (const f of PRACTICE_TESTS)
      for (const q of [...f.module1, ...f.hard, ...f.easy]) {
        expect(bank.has(q.id)).toBe(true);
        expect(poolIds.has(q.id)).toBe(false);
      }
  });

  test('only fully reviewed tests are served when unreviewed items are not allowed', () => {
    const reviewed = PRACTICE_TESTS.filter((f) =>
      [...f.module1, ...f.hard, ...f.easy].every((q) => q.reviewed),
    );
    expect(availableForms(false).map((f) => f.id)).toEqual(reviewed.map((f) => f.id));
    expect(availableForms(true)).toHaveLength(PRACTICE_TESTS.length);
  });

  for (const f of PRACTICE_TESTS) {
    test(`${f.id}: a strong module 1 gets the prepared hard module 2 and can reach 800`, () => {
      if (!formById(f.id)) return; // not served in this environment
      const a0 = startAttempt('a', new Set(), T0, undefined, f.id);
      expect(a0.formId).toBe(f.id);
      expect(a0.modules[0].ids).toEqual(f.module1.map((q) => q.id));
      const s1 = submitModule(a0, 1, answer(a0.modules[0].ids, MOCK.questionsPerModule), T0 + 30 * MIN);
      if ('error' in s1) throw new Error(s1.error);
      expect(s1.attempt.route).toBe('hard');
      expect(s1.attempt.modules[1].ids).toEqual(f.hard.map((q) => q.id));
      const b = beginModule2(s1.attempt, T0 + 31 * MIN);
      if ('error' in b) throw new Error(b.error);
      const s2 = submitModule(b.attempt, 2, answer(b.attempt.modules[1].ids, 22), T0 + 60 * MIN);
      if ('error' in s2) throw new Error(s2.error);
      expect(s2.attempt.score).toBe(800);
      expect(s2.attempt.raw).toEqual({ correct: 44, total: 44 });
    });

    test(`${f.id}: a weak module 1 gets the prepared easier module 2`, () => {
      if (!formById(f.id)) return;
      const a0 = startAttempt('a', new Set(), T0, undefined, f.id);
      const s1 = submitModule(a0, 1, answer(a0.modules[0].ids, MOCK.hardRouteAt - 1), T0 + 30 * MIN);
      if ('error' in s1) throw new Error(s1.error);
      expect(s1.attempt.route).toBe('easy');
      expect(s1.attempt.modules[1].ids).toEqual(f.easy.map((q) => q.id));
    });
  }

  test('an unknown practice test falls back to the random mock', () => {
    const a = startAttempt('a', new Set(), T0, undefined, 'nope');
    expect(a.formId).toBeUndefined();
    expect(a.modules[0].ids).toHaveLength(MOCK.questionsPerModule);
  });
});
