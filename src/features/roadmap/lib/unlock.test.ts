import { describe, expect, test } from 'bun:test';
import type { PlacementResult, StopProgress } from '../types';
import {
  activeRegion,
  allDone,
  canOpenStop,
  canRetake,
  completedRegions,
  emptyProgress,
  frontier,
  newlyCompletedRegions,
  stopStatuses,
} from './unlock';

const T0 = '2026-10-01T00:00:00.000Z';

function done(p: StopProgress[], upTo: number, at = T0, testedOut: number[] = []): StopProgress[] {
  return p.map((s) =>
    s.no <= upTo
      ? { ...s, attempts: 1, best: 1, stars: 3, completedAt: at, testedOut: testedOut.includes(s.no) }
      : s,
  );
}

describe('stopStatuses', () => {
  test('fresh roadmap: stop 1 available, the rest locked', () => {
    const st = stopStatuses(emptyProgress());
    expect(st[1]).toBe('available');
    expect(st[2]).toBe('locked');
    expect(st[26]).toBe('locked');
  });

  test('closed roadmap (no placement yet) locks everything', () => {
    expect(Object.values(stopStatuses(emptyProgress(), false)).every((s) => s === 'locked')).toBe(true);
  });

  test('passing stop N opens stop N+1', () => {
    const st = stopStatuses(done(emptyProgress(), 1));
    expect(st[1]).toBe('completed');
    expect(st[2]).toBe('available');
    expect(st[3]).toBe('locked');
  });

  test('a started frontier stop is current; tested-out stops are marked', () => {
    const p = done(emptyProgress(), 3, T0, [2]).map((s) =>
      s.no === 4 ? { ...s, attempts: 2, best: 0.5 } : s,
    );
    const st = stopStatuses(p);
    expect(st[2]).toBe('tested-out');
    expect(st[4]).toBe('current');
    expect(st[5]).toBe('locked');
  });

  test('canOpenStop follows the same linear rule', () => {
    const p = done(emptyProgress(), 4);
    expect(canOpenStop(p, 5)).toBe(true);
    expect(canOpenStop(p, 6)).toBe(false);
    expect(canOpenStop(p, 99)).toBe(false);
  });
});

describe('frontier and regions', () => {
  test('frontier is the first unfinished stop', () => {
    expect(frontier(emptyProgress())).toBe(1);
    expect(frontier(done(emptyProgress(), 7))).toBe(8);
    expect(frontier(done(emptyProgress(), 26))).toBeNull();
    expect(allDone(done(emptyProgress(), 26))).toBe(true);
  });

  test('active region counts stops done in it', () => {
    const r = activeRegion(done(emptyProgress(), 7));
    expect(r?.id).toBe('khangai');
    expect(r).toMatchObject({ done: 1, total: 4 });
  });

  test('finishing stop 6 completes the west region', () => {
    const before = done(emptyProgress(), 5);
    const after = done(emptyProgress(), 6);
    expect(completedRegions(before)).toEqual([]);
    expect(newlyCompletedRegions(before, after)).toEqual(['west']);
    expect(newlyCompletedRegions(after, after)).toEqual([]);
  });
});

describe('canRetake', () => {
  const placement: PlacementResult = {
    skipped: false,
    module2: 'easy',
    score: 0.3,
    level: 'weak',
    mastery: {},
    answers: [],
    finishedAt: T0,
  };

  test('skipped or missing placement can always be taken', () => {
    expect(canRetake(null, emptyProgress())).toBe(true);
    expect(canRetake({ ...placement, skipped: true }, emptyProgress())).toBe(true);
  });

  test('opens after 30 days', () => {
    const now = Date.parse(T0);
    expect(canRetake(placement, emptyProgress(), now + 29 * 86_400_000)).toBe(false);
    expect(canRetake(placement, emptyProgress(), now + 30 * 86_400_000)).toBe(true);
  });

  test('opens when a region is finished after the placement', () => {
    const now = Date.parse(T0) + 86_400_000;
    const later = '2026-10-01T12:00:00.000Z';
    expect(canRetake(placement, done(emptyProgress(), 6, later), now)).toBe(true);
    // a region finished before the test does not count
    expect(canRetake(placement, done(emptyProgress(), 6, '2026-09-01T00:00:00.000Z'), now)).toBe(false);
  });
});
