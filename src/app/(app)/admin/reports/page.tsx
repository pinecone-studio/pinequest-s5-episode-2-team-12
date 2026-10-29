import { AdminNotice } from '@/features/admin/components/AdminNotice';
import { ReportsView } from '@/features/admin/components/ReportsView';
import { listReports } from '@/features/admin/queries';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('admin')('reports.title') };
export const dynamic = 'force-dynamic';

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const all = (await searchParams).all === '1';
  const r = await listReports(!all);
  return r.ok ? <ReportsView reports={r.data} all={all} /> : <AdminNotice reason={r.reason} />;
}
