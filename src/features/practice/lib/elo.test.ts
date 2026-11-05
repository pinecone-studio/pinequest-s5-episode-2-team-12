import { afterEach, describe, expect, test } from 'bun:test';
import type { Question } from '@/types';
import {
  expected,
  kFactor,
  loadRatings,
  pickNext,
  QUESTION_RATING,
  type Ratings,
  ratingOf,
  START_RATING,
  satEstimate,
  saveRatings,
  TARGET,
  update,
} from './elo';

const q = (id: string, domain: Question['domain'], difficulty: 1 | 2 | 3): Question => ({
  id,
  domain,
  difficulty,
  skill: 's',
  prompt: id,
  answer: ['1'],
  explain: '',
  hint: '',
});

describe('expected', () => {
  test('equal ratings → 50%; 400 points stronger → about 91%', () => {
    expect(expected(1500, 1500)).toBeCloseTo(0.5);
    expect(expected(1900, 1500)).toBeCloseTo(0.909, 2);
    expect(expected(1100, 1500)).toBeCloseTo(0.091, 2);
  });
});

describe('update', () => {
  test('a right answer raises only that domain; a wrong one lowers it', () => {
    const up = update({}, q('a', 'alg', 2), true);
    expect(ratingOf(up, 'alg').r).toBeGreaterThan(START_RATING);
    expect(ratingOf(up, 'alg').n).toBe(1);
    expect(up.geo).toBeUndefined();
    expect(ratingOf(update({}, q('a', 'alg', 2), false), 'alg').r).toBeLessThan(START_RATING);
  });
  test('beating a hard question moves you more than beating an easy one', () => {
    const hard = ratingOf(update({}, q('h', 'adv', 3), true), 'adv').r;
    const easy = ratingOf(update({}, q('e', 'adv', 1), true), 'adv').r;
    expect(hard - START_RATING).toBeGreaterThan(easy - START_RATING);
  });
  test('steps get smaller as answers add up, and ratings stay in range', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(10));
    expect(kFactor(10)).toBeGreaterThan(kFactor(50));
    let r: Ratings = { psda: { r: 2390, n: 100 } };
    for (let i = 0; i < 50; i++) r = update(r, q('x', 'psda', 3), true);
    expect(ratingOf(r, 'psda').r).toBeLessThanOrEqual(2400);
  });
  test('a student who answers everything right climbs above the hard questions', () => {
    let r: Ratings = {};
    for (let i = 0; i < 30; i++) r = update(r, q(`${i}`, 'geo', 3), true);
    expect(ratingOf(r, 'geo').r).toBeGreaterThan(QUESTION_RATING[3]);
  });
});

describe('pickNext', () => {
  const pool = [
    q('a1', 'alg', 1),
    q('a2', 'alg', 2),
    q('a3', 'alg', 3),
    q('g1', 'geo', 1),
    q('g3', 'geo', 3),
  ];
  const fixed = (x: number) => () => x;

  test('never repeats a seen question; null when all are seen', () => {
    const seen = new Set(pool.map((x) => x.id));
    expect(pickNext(pool, {}, seen)).toBeNull();
    seen.delete('g3');
    expect(pickNext(pool, {}, seen)?.id).toBe('g3');
  });
  test('picks the difficulty closest to the target success rate', () => {
    const only = pool.filter((x) => x.domain === 'alg');
    const strong: Ratings = { alg: { r: 1950, n: 30 } };
    const weak: Ratings = { alg: { r: 1000, n: 30 } };
    expect(pickNext(only, strong, new Set(), fixed(0))?.id).toBe('a3');
    expect(pickNext(only, weak, new Set(), fixed(0))?.id).toBe('a1');
    const r = 1700;
    const best = [1, 2, 3].reduce((b, d) =>
      Math.abs(expected(r, QUESTION_RATING[d as 1]) - TARGET) <
      Math.abs(expected(r, QUESTION_RATING[b as 1]) - TARGET)
        ? d
        : b,
    );
    expect(pickNext(only, { alg: { r, n: 30 } }, new Set(), fixed(0))?.difficulty).toBe(best as 1);
  });
  test('the weak domain is chosen far more often', () => {
    const ratings: Ratings = { alg: { r: 1800, n: 30 }, geo: { r: 1100, n: 30 } };
    let geo = 0;
    let s = 1;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < 400; i++) if (pickNext(pool, ratings, new Set(), rng)?.domain === 'geo') geo++;
    expect(geo / 400).toBeGreaterThan(0.75);
  });
});

describe('satEstimate', () => {
  test('needs at least two domains with 3+ answers', () => {
    expect(satEstimate({})).toBeNull();
    expect(satEstimate({ alg: { r: 1500, n: 10 } })).toBeNull();
  });
  test('rounded to tens and kept in 200–800', () => {
    const s = satEstimate({ alg: { r: 1500, n: 10 }, geo: { r: 1400, n: 3 } }) ?? 0;
    expect(s % 10).toBe(0);
    expect(s).toBeGreaterThanOrEqual(200);
    expect(s).toBeLessThanOrEqual(800);
    expect(satEstimate({ alg: { r: 2400, n: 9 }, adv: { r: 2400, n: 9 } })).toBe(800);
  });
});

describe('storage', () => {
  afterEach(() => localStorage.clear());
  test('round trip, junk ignored', () => {
    saveRatings({ alg: { r: 1520, n: 4 } });
    expect(loadRatings()).toEqual({ alg: { r: 1520, n: 4 } });
    localStorage.setItem('suuprep.elo.v1', '{"geo":{"r":"x"},"alg":{"r":1300,"n":2}}');
    expect(loadRatings()).toEqual({ alg: { r: 1300, n: 2 } });
    localStorage.setItem('suuprep.elo.v1', 'not json');
    expect(loadRatings()).toEqual({});
  });
});
