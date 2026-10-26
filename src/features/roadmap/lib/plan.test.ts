import { describe, expect, test } from 'bun:test';
import { ROADMAP } from '../config';
import type { RoadmapState } from '../types';
import { skippedResult } from './placement';
import { blockingStop, missedOn, stopPlan, topicMastery } from './plan';
import { sampleState } from './sample';
import { initialState, withPlacement } from './state';

const open = (): RoadmapState => withPlacement(initialState(), skippedResult());

describe('stop panel plan', () => {
  test('problem count and mix follow mastery and level; minutes and XP from config', () => {
    const s = open(); // skipped → level mid, mastery ok → 8 problems
    const p = stopPlan(s, 1);
    expect(p.total).toBe(ROADMAP.setLength.ok);
    expect(p.mix.easy + p.mix.medium + p.mix.hard).toBe(p.total);
    expect(p.mix).toEqual({ easy: 2, medium: 4, hard: 2 });
    expect(p.minutes).toBe(Math.round(2 * 1.2 + 4 * 1.8 + 2 * 2.6));
    expect(p.xp).toEqual({ pass: 50, max: 70 });
  });

  test('mastery: placement first, then the student’s own attempts', () => {
    const s = open();
    expect(topicMastery(s, 1)).toEqual({ mastery: 'ok', source: 'default' });
    const tried = (best: number): RoadmapState => ({
      ...s,
      stops: s.stops.map((p) => (p.no === 1 ? { ...p, attempts: 2, best } : p)),
    });
    expect(topicMastery(tried(0.95), 1)).toEqual({ mastery: 'strong', source: 'attempts' });
    expect(topicMastery(tried(0.4), 1)).toEqual({ mastery: 'weak', source: 'attempts' });
    expect(topicMastery(tried(0.7), 1).mastery).toBe('ok');
  });

  test('a locked stop is unlocked by the earliest unfinished stop before it', () => {
    const s = sampleState(); // stops 1–4 done, 5 current
    expect(blockingStop(s, 9)).toBe(5);
    expect(blockingStop(s, 3)).toBeNull();
  });

  test('missedOn counts distinct wrong questions on the topic', () => {
    const h = [
      { qid: 'a', topicId: 2, correct: false, hintUsed: false, timeMs: 1, at: 1 },
      { qid: 'a', topicId: 2, correct: false, hintUsed: false, timeMs: 1, at: 2 },
      { qid: 'b', topicId: 2, correct: true, hintUsed: false, timeMs: 1, at: 3 },
      { qid: 'c', topicId: 3, correct: false, hintUsed: false, timeMs: 1, at: 4 },
    ];
    expect(missedOn(h, 2)).toBe(1);
  });
});
