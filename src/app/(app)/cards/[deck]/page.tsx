import { notFound } from "next/navigation";
import { dueCards } from "@/features/cards/deck-hub";
import {
  getDeck,
  getUserId,
  listCardStates,
  listDecks,
  listNotes,
} from "@/features/cards/queries";
import { StudySession } from "@/features/cards/StudySession";

export const dynamic = "force-dynamic";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ deck: string }>;
}) {
  const { deck: id } = await params;
  const userId = await getUserId();
  const deck = await getDeck(id, userId);
  if (!deck) notFound();
  const [decks, states, notes] = await Promise.all([
    listDecks(userId),
    listCardStates(userId),
    listNotes(userId),
  ]);
  const due = dueCards([deck], states, Date.now()).map((d) => d.card);
  const review = due.length === 0;
  return (
    <>
      <h1 className="sr-only">{deck.title}</h1>
      <StudySession
      deck={{ id: deck.id, title: deck.title, color: deck.color }}
      cards={review ? deck.cards : due}
      pool={decks.flatMap((d) => d.cards)}
      notes={notes}
      review={review && deck.cards.length > 0}
      //hi
    />
    </>
  );
}
