import { DailyView } from '@/features/daily/components/DailyView';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('daily')('title') };

// Section C · «Өдрийн сорил»: the same 5 problems for everyone today, server-timed, feeds the leaderboard.
export default async function DailyPage() {
  const session = await getSession().catch(() => null);
  return <DailyView demo={session?.kind !== 'user'} />;
}
