import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { loadShell } from '@/components/shell/load-shell';

/** Keep navigation available in exam mode while preserving the calm exam styling. */
export default async function ExamLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell {...(await loadShell())}>
      <div className="calm min-h-dvh py-6">{children}</div>
    </AppShell>
  );
}
