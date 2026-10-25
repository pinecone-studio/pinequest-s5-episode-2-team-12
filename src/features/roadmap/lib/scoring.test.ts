import { describe, expect, test } from 'bun:test';
import { ROADMAP } from '../config';
import type { StopProgress } from '../types';
import { mergeAttempt, neededToPass, scoreAttempt, starsFor, xpFor } from './scoring';

describe('stars', () => {
  test.each([
    [7, 10, 0, 0],
    [8, 10, 0, 1],
    [9, 10, 0, 2],
    [10, 10, 0, 3],
    [10, 10, 1, 2], // 100% but a hint was used
    [6, 8, 0, 0], // 75%
    [7, 8, 0, 1], // 87.5%
    [6, 6, 0, 3],
  ])('%i/%i with %i hints → %i★', (c, t, h, s) => {
    expect(starsFor(c / t, h)).toBe(s as 0 | 1 | 2 | 3);
  });

  test('pass threshold is 80%', () => {
    expect(scoreAttempt({ correct: 8, total: 10, hintsUsed: 3 }).passed).toBe(true);
    expect(scoreAttempt({ correct: 7, total: 10, hintsUsed: 0 }).passed).toBe(false);
  });

  test('empty set never passes', () => {
    expect(scoreAttempt({ correct: 0, total: 0, hintsUsed: 0 }).passed).toBe(false);
  });
});

describe('test-out', () => {
  test('needs every hard problem right and earns no stars', () => {
    expect(scoreAttempt({ correct: 3, total: 3, hintsUsed: 0, testOut: true })).toMatchObject({
      passed: true,
      stars: 0,
    });
    expect(scoreAttempt({ correct: 2, total: 3, hintsUsed: 0, testOut: true }).passed).toBe(false);
  });

  test('gives reduced XP', () => {
    const full = xpFor(scoreAttempt({ correct: 8, total: 10, hintsUsed: 0 }));
    const out = xpFor(scoreAttempt({ correct: 3, total: 3, hintsUsed: 0, testOut: true }));
    expect(out).toBeLessThan(full);
    expect(out).toBe(ROADMAP.xp.testOut);
  });
});

test('xp grows with stars; a failed attempt earns the small practice amount', () => {
  expect(xpFor(scoreAttempt({ correct: 10, total: 10, hintsUsed: 0 }))).toBe(
    ROADMAP.xp.stopPass + 3 * ROADMAP.xp.perStar,
  );
  expect(xpFor(scoreAttempt({ correct: 2, total: 10, hintsUsed: 0 }))).toBe(ROADMAP.xp.attempt);
});

test('neededToPass', () => {
  expect(neededToPass(10)).toBe(8);
  expect(neededToPass(8)).toBe(7);
  expect(neededToPass(6)).toBe(5);
});

describe('mergeAttempt', () => {
  const blank: StopProgress = { no: 3, best: 0, stars: 0, attempts: 0, testedOut: false, completedAt: null };

  test('keeps the best score and stars and the first completion time', () => {
    const a = mergeAttempt(blank, scoreAttempt({ correct: 10, total: 10, hintsUsed: 0 }), 'T1');
    const b = mergeAttempt(a, scoreAttempt({ correct: 8, total: 10, hintsUsed: 0 }), 'T2');
    expect(b).toEqual({ no: 3, best: 1, stars: 3, attempts: 2, testedOut: false, completedAt: 'T1' });
  });

  test('a failed attempt only counts the attempt', () => {
    const a = mergeAttempt(blank, scoreAttempt({ correct: 1, total: 10, hintsUsed: 0 }), 'T1');
    expect(a).toMatchObject({ attempts: 1, completedAt: null, stars: 0 });
  });

  test('test-out marks the stop tested out; a later full pass keeps that history', () => {
    const a = mergeAttempt(blank, scoreAttempt({ correct: 3, total: 3, hintsUsed: 0, testOut: true }), 'T1');
    expect(a).toMatchObject({ testedOut: true, completedAt: 'T1' });
  });
});
