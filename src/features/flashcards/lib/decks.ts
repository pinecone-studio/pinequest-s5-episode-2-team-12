// The two flashcard decks of /flashcards, built from content/cards: «Үгс» (math English → Mongolian) and
// «Томьёо» (formulas, KaTeX). Topic links come from the roadmap guides, so a stop can show its own cards.
// Pure (flashcards.test.ts).
import { GUIDES } from '@/features/roadmap/content/guides';
import { isDue, type ReviewState } from '@/lib/sm2';
import { dayKey } from '@/lib/time';
import { DECKS } from '@/mocks/decks';
import type { Card } from '@/types';

export type DeckId = 'words' | 'formulas';
export type FlashCard = Card & {
  /** `deckId/cardId` in content/cards — the stored key. */
  key: string;
  deck: DeckId;
  /** Content sub-deck title (Үйлдлийн үгс, Reference sheet…). */
  group: string;
  topicIds: number[];
};

const topicsOf = new Map<string, number[]>();
for (const g of GUIDES)
  for (const ref of g.cards) topicsOf.set(ref, [...(topicsOf.get(ref) ?? []), g.topicId]);

export const FLASHCARDS: FlashCard[] = DECKS.filter((d) => d.kind !== 'mine').flatMap((d) =>
  d.cards.map((c) => ({
    ...c,
    key: `${d.id}/${c.id}`,
    deck: d.kind === 'formula' ? ('formulas' as const) : ('words' as const),
    group: d.title,
    topicIds: topicsOf.get(`${d.id}/${c.id}`) ?? [],
  })),
);

/** Stored key of an admin-written word card (custom_cards, migration 0018). */
export const CUSTOM_KEY = /^custom\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type CustomCardRow = {
  id: string;
  front: string;
  back: string;
  ex: string | null;
  hook: string | null;
};

/** custom_cards row → a «Үгс» card, shown after the bundled decks. Admin-written, so already reviewed. */
export function customFlashcard(r: CustomCardRow, group: string): FlashCard {
  return {
    id: r.id,
    key: `custom/${r.id}`,
    deck: 'words',
    group,
    topicIds: [],
    front: r.front,
    back: r.back,
    ex: r.ex ?? undefined,
    hook: r.hook ?? undefined,
    art: 'grid',
    reviewed: true,
  };
}

/** SM-2 state plus when the card was first studied (for the new-cards-per-day limit). */
export type FlashState = ReviewState & { first?: number };

export type Filter = { deck?: DeckId; topicId?: number };

export const matches = (c: FlashCard, f: Filter) =>
  (!f.deck || c.deck === f.deck) && (!f.topicId || c.topicIds.includes(f.topicId));

export const FLASH = {
  /** New cards introduced per day (on top of the due reviews). */
  newPerDay: 10,
};

/** New cards still allowed today: FLASH.newPerDay minus those first studied today (Ulaanbaatar day). */
export function newLeftToday(states: Readonly<Record<string, FlashState>>, now: number): number {
  const today = dayKey(now);
  const introduced = Object.values(states).filter(
    (s) => s.first !== undefined && dayKey(s.first) === today,
  ).length;
  return Math.max(0, FLASH.newPerDay - introduced);
}

/**
 * Today's queue: due reviews (oldest first), then up to `newLeft` unseen cards in content order.
 * Cards graded «Дахин» come back within the session because their due time is minutes away.
 */
export function queue(
  cards: readonly FlashCard[],
  states: Readonly<Record<string, ReviewState>>,
  now: number,
  newLeft: number = newLeftToday(states, now),
): FlashCard[] {
  const due = cards
    .filter((c) => states[c.key] && isDue(states[c.key], now))
    .sort((a, b) => states[a.key].due - states[b.key].due);
  const fresh = cards.filter((c) => !states[c.key]).slice(0, Math.max(0, newLeft));
  return [...due, ...fresh];
}

export function counts(
  cards: readonly FlashCard[],
  states: Readonly<Record<string, ReviewState>>,
  now: number,
) {
  let due = 0;
  let learned = 0;
  for (const c of cards) {
    const s = states[c.key];
    if (!s) continue;
    if (isDue(s, now)) due++;
    if (s.interval >= 21) learned++;
  }
  return { due, fresh: cards.filter((c) => !states[c.key]).length, learned, total: cards.length };
}
