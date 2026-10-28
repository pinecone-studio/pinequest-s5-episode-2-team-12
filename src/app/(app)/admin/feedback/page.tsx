import { AdminNotice } from '@/features/admin/components/AdminNotice';
import { FeedbackView } from '@/features/admin/components/FeedbackView';
import { feedbackFilter } from '@/features/admin/lib/filters';
import { listFeedback } from '@/features/admin/queries';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('admin')('feedback.title') };
export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const filter = feedbackFilter((await searchParams).status);
  const r = await listFeedback(filter);
  return r.ok ? <FeedbackView items={r.data} filter={filter} /> : <AdminNotice reason={r.reason} />;
}
