import { describe, expect, test } from 'bun:test';
import { mockBank } from '@/features/exam/engine';
import { answerDaily, DAILY, dailyIds, pointsFor, startDaily } from './daily';

const { pool, bank } = mockBank();
const T0 = Date.parse('2026-10-26T01:00:00Z');
const right = (qid: string) => {
  const q = bank.get(qid)!;
  return typeof q.answer === 'number' ? String(q.answer) : q.answer[0];
};

describe('daily challenge', () => {
  test('same 5 questions for everyone on a day, a different set the next day', () => {
    const a = dailyIds('2026-10-26', pool);
    expect(a).toHaveLength(5);
    expect(new Set(a).size).toBe(5);
    expect(dailyIds('2026-10-26', pool)).toEqual(a);
    expect(dailyIds('2026-10-27', pool)).not.toEqual(a);
    const domains = new Set(a.slice(0, 4).map((id) => bank.get(id)!.domain));
    expect(domains.size).toBe(4);
    expect(a.map((id) => bank.get(id)!.difficulty)).toEqual(DAILY.difficulties);
  });

  test('points: 100 per correct answer plus a speed bonus', () => {
    expect(pointsFor(true, 10_000)).toBe(150);
    expect(pointsFor(true, DAILY.perQuestionMs)).toBe(100);
    expect(pointsFor(true, 105_000)).toBe(125);
    expect(pointsFor(false, 1_000)).toBe(0);
  });

  test('server clock times each answer; late answers are wrong; the run finishes after 5', () => {
    let a = startDaily('2026-10-26', pool, T0);
    let t = T0;
    for (let i = 0; i < 5; i++) {
      t += i === 2 ? DAILY.perQuestionMs + DAILY.graceMs + 1 : 20_000; // the third one is late
      const r = answerDaily(a, right(a.ids[i]), bank, t);
      if ('error' in r) throw new Error(r.error);
      a = r.attempt;
      expect(r.last.correct).toBe(i !== 2);
    }
    expect(a.finishedAt).not.toBeNull();
    expect(a.correct).toBe(4);
    expect(a.score).toBe(4 * 150);
    expect(a.flagged).toBe(false);
    expect(answerDaily(a, '1', bank, t + 1000)).toEqual({ error: 'finished' });
  });

  test('impossibly fast runs are flagged', () => {
    let a = startDaily('2026-10-26', pool, T0);
    for (let i = 0; i < 5; i++) {
      const r = answerDaily(a, right(a.ids[i]), bank, T0 + (i + 1) * 800);
      if ('error' in r) throw new Error(r.error);
      a = r.attempt;
    }
    expect(a.flagged).toBe(true);
  });
});
