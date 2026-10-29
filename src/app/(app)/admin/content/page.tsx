import { AdminNotice } from '@/features/admin/components/AdminNotice';
import { ContentView } from '@/features/admin/components/ContentView';
import { listAddedContent } from '@/features/admin/queries';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('admin')('content.title') };
export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  const r = await listAddedContent();
  return r.ok ? <ContentView sat={r.data.sat} cards={r.data.cards} /> : <AdminNotice reason={r.reason} />;
}
