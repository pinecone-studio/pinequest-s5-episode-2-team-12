'use client';
import { type RefObject, useEffect } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Shared by Modal, Sheet and the nav drawer: Escape closes, Tab stays inside, focus returns, page doesn't scroll. */
export function useDialog(open: boolean, ref: RefObject<HTMLElement | null>, onClose?: () => void) {
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const list = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => !n.hasAttribute('disabled') && n.getClientRects().length > 0,
      );
      if (!list.length) return;
      const [head, tail] = [list[0], list[list.length - 1]];
      const active = document.activeElement;
      if (e.shiftKey && (active === head || active === el)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && (active === tail || !el.contains(active))) {
        e.preventDefault();
        head.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open, ref, onClose]);
}
