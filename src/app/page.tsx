import { redirect } from 'next/navigation';
import { preload } from 'react-dom';
import { AppShell } from '@/components/shell/AppShell';
import { loadShell } from '@/components/shell/load-shell';
import { RoadmapView } from '@/features/roadmap/components/RoadmapView';
import { currentUserId, getRoadmap } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import '@/features/roadmap/roadmap.css';

// Home: the map («Монголын аялал») for students. ?demo=states shows every pin state (design review).
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession().catch(() => null);
  if (!session) redirect(routes.login());
  // the map poster is the LCP element: start the 78 KB terrain image with the HTML
  preload('/map/terrain-1024.webp', { as: 'image', fetchPriority: 'high' });
  const sp = await searchParams;
  const userId = await currentUserId();
  const [shell, server] = await Promise.all([
    loadShell(),
    userId ? getRoadmap(userId).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <AppShell {...shell} variant="map">
      <h1 className="sr-only">{getT('roadmap')('pages.roadmap.title')}</h1>
      <RoadmapView demo={!userId} server={server} sample={sp.demo === 'states'} wallet={shell.wallet} />
    </AppShell>
  );
}
