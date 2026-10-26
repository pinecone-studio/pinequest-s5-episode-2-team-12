/** Animated illustration on a card face; `Card.v` tunes it (e.g. ≥ vs ≤ on a number line). */
export type CardArt =
  | 'merge'
  | 'split'
  | 'grid'
  | 'pie'
  | 'remainder'
  | 'line'
  | 'numberline'
  | 'perp'
  | 'circle'
  | 'triangle'
  | 'bars'
  | 'parabola'
  | 'cross'
  | 'dice'
  | 'power'
  | 'solid'
  | 'rect'
  | 'angle';

export type Card = {
  id: string;
  /** English word or formula name. */
  front: string;
  ipa?: string;
  /** Pronunciation in Mongolian letters. */
  say?: string;
  /** Mongolian meaning. */
  back: string;
  /** Memory hook («санах түлхүүр»). */
  hook?: string;
  /** Example, Rich text with $…$. */
  ex?: string;
  /** Formula / key notation (TeX). */
  tex?: string;
  /** When to use (formulas). */
  when?: string;
  art: CardArt;
  v?: string;
  reviewed?: boolean;
};

export type DeckKind = 'word' | 'formula' | 'mine';

export type Deck = {
  id: string;
  kind: DeckKind;
  title: string;
  sub: string;
  /** CSS var for the deck face, e.g. var(--c-leaf). */
  color: string;
  edge: string;
  cards: Card[];
};

/** Leitner state per card. `box` 0–4, `due` epoch ms. */
export type CardState = { box: number; due: number; seen: number; ok: number };
