import { describe, expect, test } from 'bun:test';
import type { Question } from '@/types';
import { ROADMAP } from '../config';
import {
  applyRetake,
  domainBreakdown,
  type Graded,
  levelOf,
  masteryOf,
  maxPoints,
  module1,
  module2,
  routeModule2,
  skippedResult,
  weakestTopics,
  weightedScore,
} from './placement';

const P = ROADMAP.placement;

function item(topicId: number, difficulty: 1 | 2 | 3): Question {
  return {
    id: `p${topicId}-${difficulty}`,
    domain: 'alg',
    skill: 'x',
    difficulty,
    prompt: 'q',
    answer: ['1'],
    explain: '',
    hint: '',
    topicId,
    pool: 'placement',
  };
}

const ITEMS: Question[] = [
  ...P.module1Topics.map((t) => item(t, 2)),
  ...P.module2Topics.flatMap((t) => [item(t, 1), item(t, 3)]),
];

const grade = (qs: Question[], correct: (q: Question) => boolean): Graded[] =>
  qs.map((q) => ({ q, correct: correct(q) }));

describe('modules', () => {
  test('26 topics appear exactly once across module 1 + either module 2', () => {
    for (const route of ['easy', 'hard'] as const) {
      const topics = [...module1(ITEMS), ...module2(ITEMS, route)].map((q) => q.topicId);
      expect(topics).toHaveLength(26);
      expect(new Set(topics).size).toBe(26);
    }
  });

  test('module 1 is all medium; module 2 matches its route', () => {
    expect(module1(ITEMS).every((q) => q.difficulty === 2)).toBe(true);
    expect(module2(ITEMS, 'easy').every((q) => q.difficulty === 1)).toBe(true);
    expect(module2(ITEMS, 'hard').every((q) => q.difficulty === 3)).toBe(true);
  });

  test('module 1 covers all four domains (by topic)', async () => {
    const { topicById } = await import('../topics');
    const domains = new Set(P.module1Topics.map((t) => topicById(t)?.domain));
    expect(domains).toEqual(new Set(['alg', 'psda', 'adv', 'geo']));
  });

  test('throws when an item is missing', () => {
    expect(() => module1(ITEMS.slice(1))).toThrow();
  });

  test('routing: 8+ correct in module 1 → hard', () => {
    expect(routeModule2(7)).toBe('easy');
    expect(routeModule2(8)).toBe('hard');
    expect(routeModule2(13)).toBe('hard');
  });
});

describe('score and level', () => {
  test('all correct on the hard route is 100%', () => {
    const g = grade([...module1(ITEMS), ...module2(ITEMS, 'hard')], () => true);
    expect(weightedScore(g)).toBe(1);
    expect(levelOf(weightedScore(g))).toBe('strong');
  });

  test('all correct on the easy route caps below Сайн', () => {
    const g = grade([...module1(ITEMS), ...module2(ITEMS, 'easy')], () => true);
    expect(weightedScore(g)).toBeCloseTo((13 * 2 + 13) / maxPoints());
    expect(levelOf(weightedScore(g))).toBe('mid');
  });

  test('nothing correct is Сул', () => {
    expect(levelOf(weightedScore(grade(module1(ITEMS), () => false)))).toBe('weak');
  });

  test.each([
    [0, 'weak'],
    [0.399, 'weak'],
    [0.4, 'mid'],
    [0.75, 'mid'],
    [0.751, 'strong'],
    [1, 'strong'],
  ])('levelOf(%d) = %s', (s, l) => {
    expect(levelOf(s)).toBe(l as 'weak' | 'mid' | 'strong');
  });
});

describe('mastery', () => {
  test('hard correct → strong, medium/easy correct → ok, wrong → weak', () => {
    const m = masteryOf([
      { q: item(1, 2), correct: true },
      { q: item(2, 3), correct: true },
      { q: item(4, 1), correct: true },
      { q: item(6, 3), correct: false },
    ]);
    expect(m[1]).toBe('ok');
    expect(m[2]).toBe('strong');
    expect(m[4]).toBe('ok');
    expect(m[6]).toBe('weak');
    expect(Object.keys(m)).toHaveLength(26);
  });

  test('skip gives Дунд and ok everywhere', () => {
    const s = skippedResult('T');
    expect(s.level).toBe('mid');
    expect(Object.values(s.mastery).every((m) => m === 'ok')).toBe(true);
  });

  test('weakest topics: wrong easy before wrong hard, then the rest', () => {
    const w = weakestTopics([
      { q: item(2, 3), correct: false },
      { q: item(4, 1), correct: false },
      { q: item(1, 2), correct: true },
      { q: item(3, 2), correct: false },
    ]);
    expect(w).toEqual([2, 3, 4]);
  });

  test('retake keeps mastery of finished topics only', () => {
    const before = { 1: 'weak', 2: 'weak' } as const;
    const res = { ...skippedResult('T'), mastery: { 1: 'strong', 2: 'strong' } as Record<number, 'strong'> };
    const after = applyRetake({ ...before }, res, new Set([1]));
    expect(after[1]).toBe('weak');
    expect(after[2]).toBe('strong');
  });
});

test('domain breakdown uses the topic domain', () => {
  const b = domainBreakdown([
    { q: item(1, 2), correct: true },
    { q: item(22, 2), correct: false },
  ]);
  expect(b.alg).toEqual({ correct: 1, total: 1 });
  expect(b.geo).toEqual({ correct: 0, total: 1 });
});
