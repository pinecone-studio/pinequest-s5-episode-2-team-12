'use client';
import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/shell/sidebar-state';
import { Toaster } from '@/components/ui/toast';
import { OfflineSync } from '@/features/offline/OfflineSync';
import { I18nProvider } from '@/lib/i18n-client';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="mn">
      <SidebarProvider>{children}</SidebarProvider>
      <Toaster />
      <OfflineSync />
    </I18nProvider>
  );
}
