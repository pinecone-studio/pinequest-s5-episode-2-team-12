import { getProfile } from '@/features/home/queries';
import { LeaderboardView } from '@/features/social/components/LeaderboardView';
import type { Metric, Scope } from '@/features/social/lib/ranking';
import { leaderboardRows } from '@/features/social/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('social')('board.title') };

const SCOPES: Scope[] = ['friends', 'aimag', 'national'];
const METRICS: Metric[] = ['xp_week', 'xp_all', 'daily', 'mock'];

// Section F · leaderboards: friends / aimag / national × weekly XP, all-time XP, daily challenge, best mock.
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const scope = SCOPES.includes(sp.scope as Scope) ? (sp.scope as Scope) : 'friends';
  const metric = METRICS.includes(sp.metric as Metric)
    ? (sp.metric as Metric)
    : sp.period === 'daily'
      ? 'daily'
      : 'xp_week';
  const [session, profile] = await Promise.all([getSession().catch(() => null), getProfile()]);
  const userId = session?.kind === 'user' ? session.userId : null;
  const rows = userId ? await leaderboardRows(scope, metric, userId).catch(() => []) : [];
  return (
    <LeaderboardView
      demo={!userId}
      scope={scope}
      metric={metric}
      rows={rows}
      me={{ name: profile.name, aimag: profile.aimag }}
    />
  );
}
