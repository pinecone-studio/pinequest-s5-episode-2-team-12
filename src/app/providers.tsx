'use client';
import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/shell/sidebar-state';
import { Toaster } from '@/components/ui/toast';
import { I18nProvider } from '@/lib/i18n-client';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="mn">
      <SidebarProvider>{children}</SidebarProvider>
      <Toaster />
    </I18nProvider>
  );
}
