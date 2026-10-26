import { notFound } from "next/navigation";
import { getDeck, getUserId, listDecks } from "@/features/cards/queries";
import { StudySession } from "@/features/cards/StudySession";

export const dynamic = "force-dynamic";

export default async function DeckQuizPage({
  params,
}: {
  params: Promise<{ deck: string }>;
}) {
  const { deck: id } = await params;
  const userId = await getUserId();
  const deck = await getDeck(id, userId);
  if (!deck) notFound();
  const decks = await listDecks(userId);
  return (
    <>
      <h1 className="sr-only">{deck.title}</h1>
      <StudySession
      deck={{ id: deck.id, title: deck.title, color: deck.color }}
      cards={deck.cards}
      pool={decks.flatMap((d) => d.cards)}
      notes={{}}
      mode="quiz"
    />
    </>
  );
}
