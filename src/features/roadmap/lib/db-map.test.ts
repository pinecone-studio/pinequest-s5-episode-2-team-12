import { expect, test } from 'bun:test';
import { type PlacementRow, progressRow, stateFromRows, stopRow } from './db-map';
import { skippedResult } from './placement';
import { scoreAttempt } from './scoring';
import { initialState, withAttempt, withPlacement } from './state';

const placement: PlacementRow = {
  skipped: false,
  module2: 'hard',
  score: '0.8123',
  level: 'strong',
  mastery: { '1': 'strong', '2': 'weak' },
  answers: [],
  finished_at: '2026-10-25T00:00:00Z',
};

test('no rows → closed initial state', () => {
  const s = stateFromRows(null, [], null);
  expect(s.placement).toBeNull();
  expect(s.stops).toHaveLength(26);
});

test('round trip: state → rows → state', () => {
  let s = withPlacement(initialState(), skippedResult('2026-10-25T00:00:00Z'));
  s = withAttempt(s, 1, scoreAttempt({ correct: 9, total: 10, hintsUsed: 0 }), '2026-10-25T01:00:00Z').state;
  const prog = progressRow('u', s);
  expect(prog.current_stop).toBe(2);
  const stops = s.stops.filter((p) => p.attempts).map((p) => stopRow('u', p));
  expect(stops[0]).toMatchObject({ stop_no: 1, status: 'completed', stars: 2 });
  const back = stateFromRows(
    { ...prog, mastery: Object.fromEntries(Object.entries(prog.mastery).map(([k, v]) => [String(k), v])) },
    stops,
    null,
  );
  expect(back.stops).toEqual(s.stops);
  expect(back.level).toBe(s.level);
});

test('numeric strings from Postgres numeric columns become numbers', () => {
  const s = stateFromRows(
    { level: 'strong', mastery: { '2': 'weak' }, current_stop: 1, regions_done: [] },
    [
      {
        stop_no: 1,
        status: 'current',
        best: '0.5000',
        stars: 0,
        attempts: 2,
        tested_out: false,
        completed_at: null,
      },
    ],
    placement,
  );
  expect(s.stops[0].best).toBe(0.5);
  expect(s.placement?.score).toBeCloseTo(0.8123);
  expect(s.placement?.mastery[1]).toBe('strong');
  expect(s.mastery[2]).toBe('weak');
});
