import { getProfile } from '@/features/home/queries';
import { getStats } from '@/features/progress/queries';
import { RoadmapView } from '@/features/roadmap/components/RoadmapView';
import { currentUserId, getRoadmap } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('roadmap')('pages.roadmap.title') };

// Section A · «Монголын аялал». ?demo=states shows every stop-card state (design review).
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [profile, userId] = await Promise.all([getProfile(), currentUserId()]);
  const [stats, server] = await Promise.all([
    getStats(profile.id).catch(() => ({ xp: 0 })),
    userId ? getRoadmap(userId) : Promise.resolve(null),
  ]);
  return (
    <RoadmapView
      name={profile.name}
      xp={stats.xp}
      demo={!userId}
      server={server}
      sample={sp.demo === 'states'}
    />
  );
}
