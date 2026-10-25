import '@/features/roadmap/roadmap.css';
import { PlacementFlow } from '@/features/roadmap/components/PlacementFlow';
import { currentUserId, listPlacementQuestions } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('roadmap')('pages.placement.title') };

// Section A · placement test in exam mode (.calm: no nav, no animation).
export default async function PlacementPage() {
  const [items, userId] = await Promise.all([listPlacementQuestions(), currentUserId()]);
  return <PlacementFlow items={items} demo={!userId} />;
}
