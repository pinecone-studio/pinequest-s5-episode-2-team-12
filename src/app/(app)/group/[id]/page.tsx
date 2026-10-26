import { notFound } from 'next/navigation';
import { GroupView } from '@/features/social/components/GroupView';
import { groupView } from '@/features/social/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('social')('group.title') };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession().catch(() => null);
  if (session?.kind !== 'user') notFound();
  const view = await groupView(session.userId, id).catch(() => null);
  if (!view) notFound();
  return <GroupView view={view} meId={session.userId} />;
}
