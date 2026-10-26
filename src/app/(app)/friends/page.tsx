import { headers } from 'next/headers';
import { FriendsView } from '@/features/social/components/FriendsView';
import { socialOverview } from '@/features/social/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('social')('friends.title') };

export default async function FriendsPage() {
  const session = await getSession().catch(() => null);
  const userId = session?.kind === 'user' ? session.userId : null;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001';
  const origin = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
  const server = userId ? await socialOverview(userId).catch(() => null) : null;
  return <FriendsView demo={!userId} server={server} origin={origin} />;
}
