import { AdminNotice } from '@/features/admin/components/AdminNotice';
import { UsersView } from '@/features/admin/components/UsersView';
import { listUsers } from '@/features/admin/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('admin')('users.title') };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = typeof q === 'string' ? q.trim().slice(0, 80) : '';
  const [r, session] = await Promise.all([listUsers(search), getSession().catch(() => null)]);
  if (!r.ok) return <AdminNotice reason={r.reason} />;
  return (
    <UsersView
      key={search}
      users={r.data}
      search={search}
      me={session?.kind === 'user' ? session.userId : null}
    />
  );
}
