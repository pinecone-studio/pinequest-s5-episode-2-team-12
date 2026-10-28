import { AdminNotice } from '@/features/admin/components/AdminNotice';
import { OverviewView } from '@/features/admin/components/OverviewView';
import { getOverview } from '@/features/admin/queries';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('admin')('overview.title') };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const r = await getOverview();
  return r.ok ? <OverviewView data={r.data} /> : <AdminNotice reason={r.reason} />;
}
