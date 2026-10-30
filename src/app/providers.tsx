'use client';
import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/shell/sidebar-state';
import { Toaster } from '@/components/ui/toast';
import { OfflineSync } from '@/features/offline/OfflineSync';
import type { Messages } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n-client';

export function Providers({ children, messages }: { children: ReactNode; messages: Messages }) {
  return (
    <I18nProvider locale="mn" messages={messages}>
      <SidebarProvider>{children}</SidebarProvider>
      <Toaster />
      <OfflineSync />
    </I18nProvider>
  );
}
