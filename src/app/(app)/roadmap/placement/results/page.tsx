import { PlacementResults } from '@/features/roadmap/components/PlacementResults';
import { currentUserId, getRoadmap, listPlacementQuestions } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('roadmap')('pages.results.title') };

export default async function PlacementResultsPage() {
  const userId = await currentUserId();
  const [items, server] = await Promise.all([
    listPlacementQuestions(),
    userId ? getRoadmap(userId) : Promise.resolve(null),
  ]);
  return <PlacementResults items={items} demo={!userId} server={server} />;
}
