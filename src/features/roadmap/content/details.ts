// Everything the stop panel shows that is the same for every student: place fact, topic guide, intro
// screens, and the flashcards / Desmos lessons / journey lessons it links to. Server-side only (the panel
// fetches it on open, so the map's first load stays small).
import { DECKS } from '@/mocks/decks';
import { DESMOS } from '@/mocks/desmos';
import { nodeById } from '@/mocks/stages';
import { INTROS } from './bank';
import { guideFor, type TopicGuide } from './guides';
import { type PlaceFact, placeFact } from './places';
import type { IntroScreen } from './schema';

export type CardRef = { deck: string; id: string; front: string; back: string; tex?: string };
export type LinkRef = { id: string; title: string };

export type StopDetail = {
  no: number;
  place: PlaceFact | null;
  guide: TopicGuide | null;
  intros: IntroScreen[];
  cards: CardRef[];
  desmos: LinkRef[];
  lessons: LinkRef[];
};

export function cardRef(ref: string): CardRef | null {
  const [deckId, cardId] = ref.split('/');
  const card = DECKS.find((d) => d.id === deckId)?.cards.find((c) => c.id === cardId);
  if (!card) return null;
  return { deck: deckId, id: card.id, front: card.front, back: card.back, tex: card.tex };
}

export function stopDetail(no: number): StopDetail {
  const guide = guideFor(no) ?? null;
  return {
    no,
    place: placeFact(no) ?? null,
    guide,
    intros: INTROS[no] ?? [],
    cards: (guide?.cards ?? []).map(cardRef).filter((c): c is CardRef => c !== null),
    desmos: (guide?.desmos ?? [])
      .map((id) => DESMOS.find((d) => d.id === id))
      .filter((d) => d !== undefined)
      .map((d) => ({ id: d.id, title: d.title })),
    lessons: (guide?.lessons ?? [])
      .map((id) => nodeById(id))
      .filter((n) => n !== undefined)
      .map((n) => ({ id: n.id, title: n.title })),
  };
}
