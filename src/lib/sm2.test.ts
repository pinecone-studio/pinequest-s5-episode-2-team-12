import { describe, expect, test } from 'bun:test';
import { fromLeitner, isDue, newState, preview, review, SM2 } from './sm2';
import { DAY_MS } from './time';

const NOW = Date.parse('2026-10-26T02:00:00Z');

describe('SM-2 scheduling', () => {
  test('good: 1 day, then 3, then interval × ease', () => {
    let s = newState(NOW);
    s = review(s, 'good', NOW);
    expect(s).toMatchObject({ reps: 1, interval: 1, ease: 2.5 });
    s = review(s, 'good', s.due);
    expect(s.interval).toBe(3);
    s = review(s, 'good', s.due);
    expect(s.interval).toBe(Math.round(3 * 2.5));
    expect(s.due).toBe(NOW + DAY_MS * (1 + 3) + s.interval * DAY_MS);
  });

  test('again: back in 10 minutes, reps reset, ease drops, lapse counted', () => {
    const s = review(review(review(newState(NOW), 'good', NOW), 'good', NOW), 'again', NOW);
    expect(s).toMatchObject({ reps: 0, interval: 0, ease: 2.3, lapses: 1 });
    expect(s.due).toBe(NOW + SM2.relearnMs);
  });

  test('hard grows slowly and lowers ease; easy jumps and raises ease', () => {
    const base = review(review(newState(NOW), 'good', NOW), 'good', NOW); // interval 3
    expect(review(base, 'hard', NOW)).toMatchObject({ interval: 4, ease: 2.35 });
    expect(review(base, 'easy', NOW)).toMatchObject({ interval: Math.round(3 * 2.5 * 1.3), ease: 2.65 });
    expect(review(newState(NOW), 'easy', NOW).interval).toBe(3);
  });

  test('ease never drops below 1.3 and intervals are capped', () => {
    let s = newState(NOW);
    for (let i = 0; i < 20; i++) s = review(s, 'again', NOW);
    expect(s.ease).toBe(SM2.minEase);
    let t = { ...newState(NOW), reps: 5, interval: 300, ease: 3 };
    t = review(t, 'easy', NOW);
    expect(t.interval).toBe(SM2.maxInterval);
  });

  test('due, preview, Leitner migration', () => {
    const s = review(newState(NOW), 'good', NOW);
    expect(isDue(s, NOW)).toBe(false);
    expect(isDue(s, NOW + DAY_MS)).toBe(true);
    expect(isDue(undefined, NOW)).toBe(true);
    expect(preview(newState(NOW), NOW)).toEqual({ again: 0, hard: 1, good: 1, easy: 3 });
    expect(fromLeitner(3, NOW)).toEqual({ reps: 3, interval: 7, ease: 2.5, due: NOW, lapses: 0 });
  });
});
