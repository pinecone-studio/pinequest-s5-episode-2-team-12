import { describe, expect, test } from 'bun:test';
import { newState, review } from '@/lib/sm2';
import { DAY_MS } from '@/lib/time';
import { CUSTOM_KEY, counts, customFlashcard, FLASHCARDS, matches, queue } from './decks';

const NOW = Date.parse('2026-10-26T02:00:00Z');

describe('admin-written cards', () => {
  const id = '3f2b8c1e-9d4a-4b6f-8e2a-1c0d9e7f6a5b';

  test('become reviewed «words» cards keyed custom/<uuid>', () => {
    const card = customFlashcard({ id, front: 'slope', back: 'налалт', ex: null, hook: 'h' }, 'More');
    expect(card).toMatchObject({ key: `custom/${id}`, deck: 'words', group: 'More', reviewed: true });
    expect(card.ex).toBeUndefined();
    expect(matches(card, { deck: 'words' })).toBe(true);
    expect(matches(card, { topicId: 3 })).toBe(false);
  });

  test('only a well-formed custom key passes', () => {
    expect(CUSTOM_KEY.test(`custom/${id}`)).toBe(true);
    expect(CUSTOM_KEY.test('custom/not-a-uuid')).toBe(false);
    expect(CUSTOM_KEY.test(`ops/${id}`)).toBe(false);
    expect(FLASHCARDS.some((c) => CUSTOM_KEY.test(c.key))).toBe(false);
  });
});

describe('flashcard decks', () => {
  test('words and formulas, every card keyed and linked to topics where a guide uses it', () => {
    const words = FLASHCARDS.filter((c) => c.deck === 'words');
    const formulas = FLASHCARDS.filter((c) => c.deck === 'formulas');
    expect(words.length).toBeGreaterThanOrEqual(36);
    expect(formulas.length).toBeGreaterThanOrEqual(16);
    expect(new Set(FLASHCARDS.map((c) => c.key)).size).toBe(FLASHCARDS.length);
    expect(FLASHCARDS.find((c) => c.key === 'algebra/slope')?.topicIds).toEqual(
      expect.arrayContaining([6, 7]),
    );
    expect(formulas.every((c) => c.tex)).toBe(true);
    expect(FLASHCARDS.every((c) => c.reviewed === false)).toBe(true);
  });

  test('filters by deck and topic', () => {
    const slopeTopic = FLASHCARDS.filter((c) => matches(c, { topicId: 6 }));
    expect(slopeTopic.map((c) => c.key)).toContain('algebra/slope');
    expect(
      FLASHCARDS.filter((c) => matches(c, { deck: 'formulas' })).every((c) => c.deck === 'formulas'),
    ).toBe(true);
  });

  test('queue: due reviews first (oldest first), then a limited number of new cards', () => {
    const [a, b, c] = FLASHCARDS;
    const states = {
      [a.key]: { ...review(newState(NOW - 3 * DAY_MS), 'good', NOW - 3 * DAY_MS) }, // due 2 days ago
      [b.key]: { ...review(newState(NOW - 2 * DAY_MS), 'good', NOW - 2 * DAY_MS) }, // due yesterday
      [c.key]: review(newState(NOW), 'good', NOW), // due tomorrow
    };
    const q = queue(FLASHCARDS, states, NOW, 3);
    expect(q.slice(0, 2).map((x) => x.key)).toEqual([a.key, b.key]);
    expect(q).toHaveLength(5);
    expect(q.some((x) => x.key === c.key)).toBe(false);
    expect(counts(FLASHCARDS, states, NOW)).toMatchObject({ due: 2, fresh: FLASHCARDS.length - 3 });
  });
});

test('only 10 new cards a day: cards first studied today use up the allowance', async () => {
  const { newLeftToday } = await import('./decks');
  const studied = Object.fromEntries(
    FLASHCARDS.slice(0, 4).map((c) => [c.key, { ...review(newState(NOW), 'good', NOW), first: NOW }]),
  );
  expect(newLeftToday(studied, NOW)).toBe(6);
  expect(queue(FLASHCARDS, studied, NOW)).toHaveLength(6);
  // tomorrow the allowance is back and yesterday's cards are due
  expect(newLeftToday(studied, NOW + DAY_MS)).toBe(10);
  expect(queue(FLASHCARDS, studied, NOW + DAY_MS)).toHaveLength(14);
});
