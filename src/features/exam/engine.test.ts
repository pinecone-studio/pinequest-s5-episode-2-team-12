import { describe, expect, test } from 'bun:test';
import { MOCK } from './config';
import { beginModule2, mockBank, publicQuestions, seenIds, startAttempt, submitModule } from './engine';

const T0 = Date.parse('2026-10-26T01:00:00Z');
const MIN = 60_000;
const right = (qid: string) => {
  const q = mockBank().bank.get(qid)!;
  return typeof q.answer === 'number' ? String(q.answer) : q.answer[0];
};
const all = (ids: string[], ok = true) =>
  ids.map((qid) => ({ qid, answer: ok ? right(qid) : '', timeMs: 60_000 }));

describe('mock engine', () => {
  test('a full attempt: module 1 → hard route → break → module 2 → estimate', () => {
    const a0 = startAttempt('a', new Set(), T0);
    expect(a0.modules[0].ids).toHaveLength(MOCK.questionsPerModule);
    expect(Date.parse(a0.modules[0].endsAt) - T0).toBe(35 * MIN);

    const s1 = submitModule(a0, 1, all(a0.modules[0].ids), T0 + 30 * MIN);
    if ('error' in s1) throw new Error(s1.error);
    expect(s1.attempt.route).toBe('hard');
    const m2ids = s1.attempt.modules[1].ids;
    expect(m2ids.some((id) => a0.modules[0].ids.includes(id))).toBe(false);

    const b = beginModule2(s1.attempt, T0 + 33 * MIN);
    if ('error' in b) throw new Error(b.error);
    expect(Date.parse(b.attempt.modules[1].endsAt) - (T0 + 33 * MIN)).toBe(35 * MIN);

    const s2 = submitModule(b.attempt, 2, all(m2ids), T0 + 60 * MIN);
    if ('error' in s2) throw new Error(s2.error);
    expect(s2.attempt.finishedAt).not.toBeNull();
    expect(s2.attempt.score).toBe(800);
    expect(s2.attempt.raw).toEqual({ correct: 44, total: 44 });
    expect(s2.attempt.timeUsedSec).toBe((30 + 27) * 60);
    expect(s2.attempt.flagged).toBe(false);
  });

  test('a weak module 1 routes to the easier module 2', () => {
    const a0 = startAttempt('a', new Set(), T0);
    const s1 = submitModule(a0, 1, all(a0.modules[0].ids, false), T0 + 10 * MIN);
    if ('error' in s1) throw new Error(s1.error);
    expect(s1.attempt.route).toBe('easy');
  });

  test('answers after the deadline (plus grace) are discarded', () => {
    const a0 = startAttempt('a', new Set(), T0);
    const late = submitModule(a0, 1, all(a0.modules[0].ids), T0 + 35 * MIN + MOCK.graceMs + 1);
    if ('error' in late) throw new Error(late.error);
    expect(late.late).toBe(true);
    expect(late.attempt.modules[0].answers.every((x) => !x.correct)).toBe(true);
    const onTime = submitModule(a0, 1, all(a0.modules[0].ids), T0 + 35 * MIN + MOCK.graceMs - 1);
    if ('error' in onTime) throw new Error(onTime.error);
    expect(onTime.late).toBe(false);
  });

  test('steps out of order are refused; the break cannot be stretched', () => {
    const a0 = startAttempt('a', new Set(), T0);
    expect(submitModule(a0, 2, [], T0)).toEqual({ error: 'wrong_module' });
    const s1 = submitModule(a0, 1, [], T0 + 5 * MIN);
    if ('error' in s1) throw new Error(s1.error);
    expect(submitModule(s1.attempt, 1, [], T0 + 6 * MIN)).toEqual({ error: 'wrong_module' });
    // came back an hour later: module 2 started when the 10-minute break ended
    const b = beginModule2(s1.attempt, T0 + 65 * MIN);
    if ('error' in b) throw new Error(b.error);
    expect(Date.parse(b.attempt.modules[1].startedAt)).toBe(T0 + 15 * MIN);
  });

  test('public questions and seen ids', () => {
    const a0 = startAttempt('a', new Set(), T0);
    const qs = publicQuestions(a0.modules[0].ids);
    expect(qs).toHaveLength(22);
    expect(qs.every((q) => !('answer' in q))).toBe(true);
    const next = startAttempt('b', seenIds([a0]), T0 + MIN);
    const overlap = next.modules[0].ids.filter((id) => a0.modules[0].ids.includes(id)).length;
    expect(overlap).toBe(0);
  });
});
