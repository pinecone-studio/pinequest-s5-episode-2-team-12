'use client';
import { createContext, type ReactNode, useContext, useState } from 'react';

type SidebarState = { open: boolean; setOpen: (open: boolean) => void };
const SidebarContext = createContext<SidebarState | null>(null);

/** The root provider keeps the drawer state when navigation replaces an app layout. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <SidebarContext value={{ open, setOpen }}>{children}</SidebarContext>;
}

export function useSidebar() {
  const state = useContext(SidebarContext);
  if (!state) throw new Error('useSidebar requires SidebarProvider');
  return state;
}
