import { notFound } from 'next/navigation';
import { AdminNotice } from '@/features/admin/components/AdminNotice';
import { UserDetailView } from '@/features/admin/components/UserDetailView';
import { getUserDetail } from '@/features/admin/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('admin')('detail.title') };
export const dynamic = 'force-dynamic';

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, session] = await Promise.all([getUserDetail(id), getSession().catch(() => null)]);
  if (!r.ok) return <AdminNotice reason={r.reason} />;
  if (!r.data) notFound();
  return <UserDetailView detail={r.data} me={session?.kind === 'user' ? session.userId : null} />;
}
