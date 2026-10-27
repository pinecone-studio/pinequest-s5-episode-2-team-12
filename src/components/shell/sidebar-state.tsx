'use client';
import { createContext, type ReactNode, useContext, useState } from 'react';

type SidebarState = {
  /** Phone/tablet drawer (overlay). */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Desktop rail: icons only when false, icons + labels when true. */
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};
const SidebarContext = createContext<SidebarState | null>(null);

/** The root provider keeps the drawer state when navigation replaces an app layout. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return <SidebarContext value={{ open, setOpen, expanded, setExpanded }}>{children}</SidebarContext>;
}

export function useSidebar() {
  const state = useContext(SidebarContext);
  if (!state) throw new Error('useSidebar requires SidebarProvider');
  return state;
}
