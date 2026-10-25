import { expect, test } from 'bun:test';
import { isActive, NAV } from './nav';

test('isActive matches the item and its children only', () => {
  expect(isActive('/cards', '/cards')).toBe(true);
  expect(isActive('/cards/ops/quiz', '/cards')).toBe(true);
  expect(isActive('/cardsx', '/cards')).toBe(false);
  expect(isActive('/bank', '/bank?domain=alg')).toBe(true);
});

test('every nav item has a unique key and at most 4 mobile tabs', () => {
  const items = NAV.flatMap((g) => g.items);
  expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  expect(items.filter((i) => i.mobile).length).toBeLessThanOrEqual(4);
});

test('practice and materials fold; home, journey, roadmap, tutor, planner and me stay open', () => {
  const open = NAV.filter((g) => !g.collapsible).flatMap((g) => g.items.map((i) => i.key));
  expect(open).toEqual(['dashboard', 'journey', 'roadmap', 'tutor', 'planner', 'progress', 'achievements']);
  expect(NAV.filter((g) => g.collapsible).map((g) => g.key)).toEqual(['practice', 'materials']);
});
