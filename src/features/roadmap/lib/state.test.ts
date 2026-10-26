import { describe, expect, test } from 'bun:test';
import { ROADMAP } from '../config';
import type { PlacementResult } from '../types';
import { skippedResult } from './placement';
import { scoreAttempt } from './scoring';
import { initialState, isOpen, isRoadmapState, setLengthAt, withAttempt, withPlacement } from './state';
import { stopStatuses } from './unlock';

const pass = scoreAttempt({ correct: 10, total: 10, hintsUsed: 0 });
const fail = scoreAttempt({ correct: 3, total: 10, hintsUsed: 0 });

function result(level: PlacementResult['level'], m: PlacementResult['mastery']): PlacementResult {
  return { skipped: false, module2: 'hard', score: 0.8, level, mastery: m, answers: [], finishedAt: 'T' };
}

describe('placement', () => {
  test('roadmap is closed until placement is taken or skipped', () => {
    const s = initialState();
    expect(isOpen(s)).toBe(false);
    expect(isOpen(withPlacement(s, skippedResult('T')))).toBe(true);
  });

  test('placement sets level and mastery (→ set length)', () => {
    const s = withPlacement(initialState(), result('strong', { 1: 'weak', 2: 'strong' }));
    expect(s.level).toBe('strong');
    expect(setLengthAt(s, 1)).toBe(10);
    expect(setLengthAt(s, 2)).toBe(6);
  });

  test('a skip never overwrites a real test', () => {
    const s = withPlacement(initialState(), result('strong', { 1: 'strong' }));
    expect(withPlacement(s, skippedResult('T2')).level).toBe('strong');
  });

  test('a retake keeps mastery of finished stops', () => {
    let s = withPlacement(initialState(), result('weak', { 1: 'weak', 2: 'weak' }));
    s = withAttempt(s, 1, pass, 'T').state;
    s = withPlacement(s, result('strong', { 1: 'strong', 2: 'strong' }));
    expect(s.mastery[1]).toBe('weak');
    expect(s.mastery[2]).toBe('strong');
  });
});

describe('attempts', () => {
  test('pass unlocks the next stop and earns XP', () => {
    const s = withPlacement(initialState(), skippedResult('T'));
    const out = withAttempt(s, 1, pass, 'T1');
    expect(stopStatuses(out.state.stops)[2]).toBe('available');
    expect(out.xp).toBe(ROADMAP.xp.stopPass + 3 * ROADMAP.xp.perStar);
    expect(out.badges).toEqual([]);
  });

  test('fail keeps the stop current and locks nothing new', () => {
    const s = withPlacement(initialState(), skippedResult('T'));
    const out = withAttempt(s, 1, fail, 'T1');
    const st = stopStatuses(out.state.stops);
    expect(st[1]).toBe('current');
    expect(st[2]).toBe('locked');
  });

  test('finishing a region awards its badge once', () => {
    let s = withPlacement(initialState(), skippedResult('T'));
    for (let no = 1; no <= 5; no++) s = withAttempt(s, no, pass, 'T').state;
    const out = withAttempt(s, 6, pass, 'T');
    expect(out.badges).toEqual(['roadmap-west']);
    expect(out.xp).toBe(ROADMAP.xp.stopPass + 3 * ROADMAP.xp.perStar + ROADMAP.xp.region);
    expect(withAttempt(out.state, 6, pass, 'T').badges).toEqual([]);
  });

  test('stop 26 gives the final badge', () => {
    let s = withPlacement(initialState(), skippedResult('T'));
    let last = withAttempt(s, 1, pass, 'T');
    for (let no = 1; no <= 26; no++) {
      last = withAttempt(s, no, pass, 'T');
      s = last.state;
    }
    expect(last.finishedAll).toBe(true);
    expect(last.badges).toContain('roadmap-final');
    expect(last.badges).toContain('roadmap-central');
  });
});

test('isRoadmapState guards stored data', () => {
  expect(isRoadmapState(initialState())).toBe(true);
  expect(isRoadmapState(null)).toBe(false);
  expect(isRoadmapState({ ...initialState(), stops: [] })).toBe(false);
});
