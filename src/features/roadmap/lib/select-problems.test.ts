import { describe, expect, test } from 'bun:test';
import type { ProblemAttempt } from '../types';
import { type QuestionMeta, seeded, selectProblems, splitCounts } from './select-problems';

/** n questions per difficulty for a topic. */
function pool(topicId: number, n: number): QuestionMeta[] {
  return ([1, 2, 3] as const).flatMap((d) =>
    Array.from({ length: n }, (_, i) => ({ id: `t${topicId}-d${d}-${i}`, topicId, difficulty: d })),
  );
}

const diffOf = (id: string) => Number(id.split('-d')[1][0]);
const count = (ids: string[], d: number) => ids.filter((id) => diffOf(id) === d).length;

describe('splitCounts', () => {
  test.each([
    [10, { easy: 0.6, medium: 0.3, hard: 0.1 }, [6, 3, 1]],
    [10, { easy: 0.3, medium: 0.5, hard: 0.2 }, [3, 5, 2]],
    [8, { easy: 0.3, medium: 0.5, hard: 0.2 }, [2, 4, 2]],
    [6, { easy: 0.1, medium: 0.4, hard: 0.5 }, [1, 2, 3]],
  ])('%i × mix', (n, mix, [e, m, h]) => {
    const c = splitCounts(n, mix);
    expect([c.easy, c.medium, c.hard]).toEqual([e, m, h]);
    expect(c.easy + c.medium + c.hard).toBe(n);
  });
});

describe('selectProblems', () => {
  const big = [...pool(1, 10), ...pool(2, 10)];

  test('length follows mastery: weak 10, ok 8, strong 6', () => {
    for (const [m, n] of [
      ['weak', 10],
      ['ok', 8],
      ['strong', 6],
    ] as const) {
      expect(
        selectProblems({ topicId: 1, level: 'mid', mastery: m, pool: big, history: [], rng: seeded(1) }),
      ).toHaveLength(n);
    }
  });

  test('only the requested topic, no duplicates, easy → hard order', () => {
    const ids = selectProblems({
      topicId: 2,
      level: 'mid',
      mastery: 'weak',
      pool: big,
      history: [],
      rng: seeded(2),
    });
    expect(ids.every((id) => id.startsWith('t2-'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    const ds = ids.map(diffOf);
    expect([...ds].sort()).toEqual(ds);
  });

  test('difficulty mix follows the level', () => {
    const weak = selectProblems({
      topicId: 1,
      level: 'weak',
      mastery: 'weak',
      pool: big,
      history: [],
      rng: seeded(3),
    });
    expect([count(weak, 1), count(weak, 2), count(weak, 3)]).toEqual([6, 3, 1]);
    const strong = selectProblems({
      topicId: 1,
      level: 'strong',
      mastery: 'weak',
      pool: big,
      history: [],
      rng: seeded(3),
    });
    expect([count(strong, 1), count(strong, 2), count(strong, 3)]).toEqual([1, 4, 5]);
  });

  test('test-out draws 3 hard problems', () => {
    const ids = selectProblems({
      topicId: 1,
      level: 'weak',
      mastery: 'strong',
      pool: big,
      history: [],
      rng: seeded(4),
      testOut: true,
    });
    expect(ids).toHaveLength(3);
    expect(count(ids, 3)).toBe(3);
  });

  test('deterministic for the same seed', () => {
    const a = selectProblems({
      topicId: 1,
      level: 'mid',
      mastery: 'ok',
      pool: big,
      history: [],
      rng: seeded(9),
    });
    const b = selectProblems({
      topicId: 1,
      level: 'mid',
      mastery: 'ok',
      pool: big,
      history: [],
      rng: seeded(9),
    });
    expect(a).toEqual(b);
  });

  test('a retry prefers unseen questions (fresh draw)', () => {
    const first = selectProblems({
      topicId: 1,
      level: 'mid',
      mastery: 'strong',
      pool: big,
      history: [],
      rng: seeded(5),
    });
    const history: ProblemAttempt[] = first.map((qid, i) => ({
      qid,
      topicId: 1,
      correct: true,
      hintUsed: false,
      timeMs: 1000,
      at: i,
    }));
    let overlap = 0;
    for (let s = 0; s < 20; s++) {
      const next = selectProblems({
        topicId: 1,
        level: 'mid',
        mastery: 'strong',
        pool: big,
        history,
        rng: seeded(100 + s),
      });
      overlap += next.filter((id) => first.includes(id)).length;
    }
    // unseen weigh 4× a seen-correct question; with 7+ unseen per difficulty overlap stays low
    expect(overlap / 20).toBeLessThan(2);
  });

  test('missed questions come back more often than ones answered correctly', () => {
    const small = pool(1, 2); // 2 per difficulty
    const [right, wrong] = small.filter((q) => q.difficulty === 2).map((q) => q.id);
    const history: ProblemAttempt[] = [
      { qid: right, topicId: 1, correct: true, hintUsed: false, timeMs: 1, at: 1 },
      { qid: wrong, topicId: 1, correct: false, hintUsed: false, timeMs: 1, at: 2 },
    ];
    let r = 0;
    let w = 0;
    for (let s = 0; s < 400; s++) {
      // strong level, strong mastery → 6 problems with 2 medium wanted out of… force 1 medium pick via level mix
      const ids = selectProblems({
        topicId: 1,
        level: 'weak',
        mastery: 'strong',
        pool: small,
        history,
        rng: seeded(s),
      });
      const mediums = ids.filter((id) => diffOf(id) === 2);
      if (mediums[0] === right) r++;
      if (mediums[0] === wrong) w++;
    }
    expect(w).toBeGreaterThan(r);
  });

  test('borrows from a neighbouring difficulty when one runs short', () => {
    const lopsided: QuestionMeta[] = [
      ...Array.from({ length: 2 }, (_, i) => ({ id: `t1-d1-${i}`, topicId: 1, difficulty: 1 as const })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `t1-d2-${i}`, topicId: 1, difficulty: 2 as const })),
    ];
    const ids = selectProblems({
      topicId: 1,
      level: 'weak',
      mastery: 'weak',
      pool: lopsided,
      history: [],
      rng: seeded(1),
    });
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  test('repeats only when the pool is smaller than the set', () => {
    const tiny = pool(1, 1); // 3 questions
    const ids = selectProblems({
      topicId: 1,
      level: 'mid',
      mastery: 'weak',
      pool: tiny,
      history: [],
      rng: seeded(1),
    });
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(3);
  });

  test('empty topic gives an empty set', () => {
    expect(selectProblems({ topicId: 9, level: 'mid', mastery: 'ok', pool: big, history: [] })).toEqual([]);
  });
});
