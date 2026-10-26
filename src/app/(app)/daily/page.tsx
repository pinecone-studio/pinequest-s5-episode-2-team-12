import { loadShell } from '@/components/shell/load-shell';
import { DailyView } from '@/features/daily/components/DailyView';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('daily')('title') };

// Section C · «Өдрийн сорил»: the same 5 problems for everyone today, server-timed, feeds the leaderboard.
export default async function DailyPage() {
  const shell = await loadShell();
  return <DailyView demo={shell.demo} wallet={shell.wallet} />;
}
