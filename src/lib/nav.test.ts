import { expect, test } from 'bun:test';
import { isActive, NAV } from './nav';

test('isActive matches the item and its children only', () => {
  expect(isActive('/cards', '/cards')).toBe(true);
  expect(isActive('/cards/ops/quiz', '/cards')).toBe(true);
  expect(isActive('/cardsx', '/cards')).toBe(false);
  expect(isActive('/bank', '/bank?domain=alg')).toBe(true);
});

test('home is active only on the map itself', () => {
  expect(isActive('/', '/')).toBe(true);
  expect(isActive('/profile', '/')).toBe(false);
});

test('every nav item has a unique key and href', () => {
  const items = NAV.flatMap((g) => g.items);
  expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
});

test('drawer order follows the spec; only Материал folds', () => {
  expect(NAV[0].items.map((i) => i.key)).toEqual([
    'map',
    'practicePlayer',
    'mock',
    'tutor',
    'flashcards',
    'mistakes',
    'daily',
    'friends',
    'leaderboard',
    'shop',
    'planner',
  ]);
  expect(NAV.filter((g) => g.collapsible).map((g) => g.key)).toEqual(['materials']);
  expect(NAV.at(-1)?.items.map((i) => i.key)).toEqual(['achievements', 'settings']);
});
