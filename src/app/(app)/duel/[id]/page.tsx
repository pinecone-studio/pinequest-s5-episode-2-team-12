import { DuelView } from '@/features/social/components/DuelView';
import { duelState } from '@/features/social/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('social')('duels.title') };

export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession().catch(() => null);
  const userId = session?.kind === 'user' ? session.userId : null;
  const state = userId ? await duelState(userId, id).catch(() => null) : null;
  return <DuelView id={id} demo={!userId} server={state} />;
}
