import { PlannerDemo } from '@/features/planner/components/PlannerDemo';
import { currentUserId, getRoadmap } from '@/features/roadmap/queries';
import { PHASES, SAT_DATES } from '@/mocks/meta';

// Section I · I4 — pitch demo: computed phases + a sample week (see features/planner/lib/demo-plan.ts).
// ?weak=1,5,9 (from the placement results) preselects those roadmap topics as weak.
export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.weak === 'string' ? sp.weak : '';
  const ids = raw
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 26)
    .slice(0, 5);
  const userId = await currentUserId();
  const server = userId ? await getRoadmap(userId).catch(() => null) : null;
  return <PlannerDemo dates={SAT_DATES} phases={PHASES} roadmap={{ demo: !userId, server, ids }} />;
}
