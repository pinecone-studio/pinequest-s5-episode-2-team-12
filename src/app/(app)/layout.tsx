import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { loadShell } from '@/components/shell/load-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell {...(await loadShell())}>{children}</AppShell>;
}
