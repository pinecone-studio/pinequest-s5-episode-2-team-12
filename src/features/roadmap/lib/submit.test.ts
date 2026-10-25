import { describe, expect, test } from 'bun:test';
import type { Question } from '@/types';
import { ROADMAP } from '../config';
import { module1, module2, skippedResult } from './placement';
import { initialState, withPlacement } from './state';
import { gradePlacementSubmission, gradeStopSubmission, type SubmittedAnswer } from './submit';

const P = ROADMAP.placement;
const q = (id: string, topicId: number, difficulty: 1 | 2 | 3, pool: 'stop' | 'placement'): Question => ({
  id,
  domain: 'alg',
  skill: 's',
  difficulty,
  prompt: 'p',
  answer: ['1'],
  explain: '',
  hint: '',
  topicId,
  pool,
  format: 'spr',
});

const ITEMS = [
  ...P.module1Topics.map((t) => q(`m${t}`, t, 2, 'placement')),
  ...P.module2Topics.flatMap((t) => [q(`e${t}`, t, 1, 'placement'), q(`h${t}`, t, 3, 'placement')]),
];

const answer = (qs: Question[], right: number): SubmittedAnswer[] =>
  qs.map((x, i) => ({ qid: x.id, answer: i < right ? '1' : '9', timeMs: 1000 }));

describe('placement submission', () => {
  test('8+ right in module 1 must be followed by the hard module 2', () => {
    const m1 = answer(module1(ITEMS), 13);
    const ok = gradePlacementSubmission(ITEMS, [...m1, ...answer(module2(ITEMS, 'hard'), 13)]);
    expect('result' in ok && ok.result.level).toBe('strong');
    const forged = gradePlacementSubmission(ITEMS, [...m1, ...answer(module2(ITEMS, 'easy'), 13)]);
    expect(forged).toEqual({ error: 'invalid_input' });
  });

  test('the browser cannot claim correct answers: grading uses the stored keys', () => {
    const m1 = answer(module1(ITEMS), 0);
    const r = gradePlacementSubmission(ITEMS, [...m1, ...answer(module2(ITEMS, 'easy'), 0)]);
    expect('result' in r && r.result.level).toBe('weak');
    expect('result' in r && r.result.mastery[1]).toBe('weak');
  });

  test('missing items → placement unavailable; wrong count → invalid', () => {
    expect(gradePlacementSubmission([], [])).toEqual({ error: 'placement_unavailable' });
    expect(gradePlacementSubmission(ITEMS, [])).toEqual({ error: 'invalid_input' });
  });
});

describe('stop submission', () => {
  const pool = Array.from({ length: 12 }, (_, i) => q(`s${i}`, 1, ((i % 3) + 1) as 1 | 2 | 3, 'stop'));
  const open = withPlacement(initialState(), skippedResult('T')); // ok mastery → 8 problems

  test('locked until placement, and only the frontier or earlier stops', () => {
    expect(gradeStopSubmission(initialState(), 1, false, pool, [])).toEqual({ error: 'locked' });
    expect(gradeStopSubmission(open, 2, false, pool, [])).toEqual({ error: 'locked' });
  });

  test('length must match the set length for the mastery', () => {
    expect(gradeStopSubmission(open, 1, false, pool, answer(pool.slice(0, 5), 5))).toEqual({
      error: 'invalid_input',
    });
  });

  test('questions must belong to the stop topic', () => {
    const other = [...pool.slice(0, 7), q('x', 2, 1, 'stop')];
    expect(gradeStopSubmission(open, 1, false, [...pool, other[7]], answer(other, 8))).toEqual({
      error: 'invalid_input',
    });
  });

  test('grades 7/8 as a pass with 1 star… 8/8 as 3 stars', () => {
    const r = gradeStopSubmission(open, 1, false, pool, answer(pool.slice(0, 8), 7));
    expect('result' in r && r.result).toMatchObject({ passed: true, stars: 1 });
    const full = gradeStopSubmission(open, 1, false, pool, answer(pool.slice(0, 8), 8));
    expect('result' in full && full.result.stars).toBe(3);
  });

  test('test-out only for strong mastery', () => {
    expect(gradeStopSubmission(open, 1, true, pool, answer(pool.slice(0, 3), 3))).toEqual({
      error: 'invalid_input',
    });
    const strong = { ...open, mastery: { ...open.mastery, 1: 'strong' as const } };
    const r = gradeStopSubmission(strong, 1, true, pool, answer(pool.slice(0, 3), 3));
    expect('result' in r && r.result).toMatchObject({ passed: true, testOut: true });
  });
});
