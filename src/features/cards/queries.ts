import { getDb } from '@/lib/supabase/server';
import { DECKS } from '@/mocks/decks';
import type { Card, CardState, Deck, DeckKind } from '@/types';
import {
  countsByKind,
  type DeckSummary,
  type DueCard,
  dueCards,
  type StatusCounts,
  summarizeDecks,
} from './deck-hub';
import { demoUser } from './lib/demo-store';
import { MY_DECK_ID, reviewDeckId } from './my-deck';

export { MY_DECK_ID };

export const DEMO_USER_ID = 'u-demo';

const REVIEW_TITLE: Record<DeckKind, string> = {
  word: 'Өнөөдрийн давталт · Үгс',
  formula: 'Өнөөдрийн давталт · Томьёо',
  mine: 'Өнөөдрийн давталт · Миний багц',
};

type StateRow = {
  card_id: string;
  box: number;
  due_at: string;
  seen: number;
  ok: number;
};
type NoteRow = { card_id: string; text: string };
type MyCardRow = {
  id: string;
  front: string;
  back: string;
  hook: string | null;
  ex: string | null;
};

export async function getUserId(): Promise<string> {
  const db = await getDb();
  if (!db) return DEMO_USER_ID;
  const { data } = await db.auth.getUser();
  return data.user?.id ?? DEMO_USER_ID;
}

export function toMyCard(r: MyCardRow): Card {
  return {
    id: `my-${r.id}`,
    front: r.front,
    back: r.back,
    hook: r.hook || undefined,
    ex: r.ex || undefined,
    art: 'merge',
  };
}

export async function listMyCards(userId: string): Promise<Card[]> {
  const db = await getDb();
  if (!db) return [...demoUser(userId).mine];
  const { data, error } = await db
    .from('my_cards')
    .select('id, front, back, hook, ex')
    .eq('user_id', userId)
    .order('created_at');
  if (error || !data) return [];
  return (data as MyCardRow[]).map(toMyCard);
}

export function myDeck(cards: Card[]): Deck {
  return {
    id: MY_DECK_ID,
    kind: 'mine',
    title: 'Миний багц',
    sub: 'Өөрөө нэмсэн карт',
    color: 'var(--c-forest-2)',
    edge: 'var(--c-edge)',
    cards,
  };
}

export async function listDecks(userId?: string): Promise<Deck[]> {
  if (!userId) return DECKS;
  const mine = await listMyCards(userId);
  return mine.length ? [...DECKS, myDeck(mine)] : DECKS;
}

export async function getDeck(id: string, userId?: string): Promise<Deck | null> {
  if (id === MY_DECK_ID) return userId ? myDeck(await listMyCards(userId)) : null;
  const kind = (['word', 'formula', 'mine'] as DeckKind[]).find((k) => reviewDeckId(k) === id);
  if (kind) {
    const decks = await listDecks(userId);
    return {
      id,
      kind,
      title: REVIEW_TITLE[kind],
      sub: '',
      color: 'var(--c-leaf)',
      edge: 'var(--c-leaf-2)',
      cards: decks.filter((d) => d.kind === kind).flatMap((d) => d.cards),
    };
  }
  return DECKS.find((d) => d.id === id) ?? null;
}

export async function listCardStates(userId: string): Promise<Record<string, CardState>> {
  const db = await getDb();
  if (!db) return { ...demoUser(userId).states };
  const { data, error } = await db
    .from('card_states')
    .select('card_id, box, due_at, seen, ok')
    .eq('user_id', userId);
  if (error || !data) return {};
  return Object.fromEntries(
    (data as StateRow[]).map((r) => [
      r.card_id,
      { box: r.box, due: Date.parse(r.due_at), seen: r.seen, ok: r.ok },
    ]),
  );
}

export async function listDueCards(userId: string, now: number = Date.now()): Promise<DueCard[]> {
  const [decks, states] = await Promise.all([listDecks(userId), listCardStates(userId)]);
  return dueCards(decks, states, now);
}

export async function listNotes(userId: string): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return { ...demoUser(userId).notes };
  const { data, error } = await db.from('card_notes').select('card_id, text').eq('user_id', userId);
  if (error || !data) return {};
  return Object.fromEntries((data as NoteRow[]).map((r) => [r.card_id, r.text]));
}

export type HubData = {
  summaries: DeckSummary[];
  counts: Record<DeckKind, StatusCounts>;
  myCards: Card[];
};

export async function loadHub(): Promise<HubData> {
  const userId = await getUserId();
  const [decks, due, states, myCards] = await Promise.all([
    listDecks(userId),
    listDueCards(userId),
    listCardStates(userId),
    listMyCards(userId),
  ]);
  return {
    summaries: summarizeDecks(decks, due, states),
    counts: countsByKind(decks, states),
    myCards,
  };
}
