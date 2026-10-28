import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminTabs } from '@/features/admin/components/AdminTabs';
import { adminUserId } from '@/features/roadmap/admin';

// Every /admin page: only profiles.role = 'admin' gets in. Students and signed-out visitors get a 404, so the
// section doesn't advertise itself. Without Supabase (demo) the pages render read-only notices.
// The database checks the role again in every admin_* RPC, so this guard is about UX, not the only lock.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const who = await adminUserId();
  if ('reason' in who && who.reason === 'forbidden') notFound();
  return (
    <div className="workspace-page max-w-6xl">
      <AdminTabs />
      {children}
    </div>
  );
}
