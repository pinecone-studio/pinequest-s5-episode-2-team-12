import { expect, test } from 'bun:test';
import { getT } from '@/lib/i18n';
import { skippedResult } from './placement';
import { scoreAttempt } from './scoring';
import { initialState, withAttempt, withPlacement } from './state';
import { stopAriaLabel, stopViews } from './view';

const t = getT('roadmap');

test('aria label reads number, place, topic and state', () => {
  const v = stopViews(initialState(), true).find((x) => x.stop.no === 6)!;
  expect(stopAriaLabel(v, t)).toBe('6-р зогсоол, Мөрөн, Шулуун ба шугаман тэгшитгэл, түгжээтэй');
});

test('completed stops mention their stars', () => {
  let s = withPlacement(initialState(), skippedResult('T'));
  s = withAttempt(s, 1, scoreAttempt({ correct: 9, total: 10, hintsUsed: 0 }), 'T').state;
  const v = stopViews(s, true)[0];
  expect(stopAriaLabel(v, t)).toBe('1-р зогсоол, Өлгий, Зэрэг ба язгуур, дууссан, 2 од');
});

test('ring shows best correct against the pass mark of the set length', () => {
  let s = withPlacement(initialState(), skippedResult('T')); // ok → 8 problems, need 7
  s = withAttempt(s, 1, scoreAttempt({ correct: 4, total: 8, hintsUsed: 0 }), 'T').state;
  expect(stopViews(s, true)[0].ring).toEqual({ have: 4, need: 7, total: 8 });
});

test('26 stops, one topic each', () => {
  const vs = stopViews(initialState(), false);
  expect(vs).toHaveLength(26);
  expect(vs.map((v) => v.topic.id)).toEqual(vs.map((v) => v.stop.no));
  expect(vs.every((v) => v.status === 'locked')).toBe(true);
});
