import { EmptyState } from '@/components/ui/EmptyState';
import { getT } from '@/lib/i18n';
import type { AdminFailure } from '../queries';

/** Why an admin page has no data (Supabase off, migration 0017 not run, not an admin, DB error). */
export function AdminNotice({ reason }: { reason: AdminFailure }) {
  const t = getT('admin');
  return <EmptyState title={t('title')} sub={t(`notice.${reason}`)} />;
}
