import { FlashcardsView } from '@/features/flashcards/components/FlashcardsView';
import { listFlashStates, listReviewedCards } from '@/features/flashcards/queries';
import { frontier } from '@/features/roadmap/lib/unlock';
import { getRoadmap } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('flashcards')('title') };

// Section E · flashcards with SM-2. ?topic=N opens the cards of one roadmap topic (from the stop panel).
export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession().catch(() => null);
  const userId = session?.kind === 'user' ? session.userId : null;
  const [states, roadmap, reviewed] = await Promise.all([
    userId ? listFlashStates(userId).catch(() => ({})) : Promise.resolve({}),
    userId ? getRoadmap(userId).catch(() => null) : Promise.resolve(null),
    listReviewedCards().catch(() => []),
  ]);
  const topic = Number(sp.topic);
  return (
    <FlashcardsView
      demo={!userId}
      serverStates={states}
      currentStop={roadmap?.placement ? frontier(roadmap.stops) : null}
      reviewed={reviewed}
      initialTopic={Number.isInteger(topic) && topic >= 1 && topic <= 26 ? topic : undefined}
    />
  );
}
