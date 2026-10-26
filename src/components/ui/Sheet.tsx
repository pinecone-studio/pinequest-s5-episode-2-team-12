'use client';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useDialog } from './useDialog';

/**
 * Bottom sheet on phones, right-side panel from md up. Rendered into <body> so it sits above the app's
 * floating top bar even when opened from inside a fixed layer (the map home).
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  className,
  phoneHeight = 'max-h-[85dvh]',
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  /** Max height on phones (Tailwind class); lower it when what's behind the sheet matters (the map). */
  phoneHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useDialog(open && mounted, ref, onClose);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="close"
        tabIndex={-1}
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--c-forest)_45%,transparent)] cursor-default"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'absolute bg-paper border-line shadow-pop sheet-in',
          phoneHeight,
          'inset-x-0 bottom-0 overflow-y-auto rounded-t-[28px] border-t-[1.5px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]',
          'md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:max-h-none md:rounded-none md:rounded-l-[28px] md:border-l-[1.5px] md:border-t-0 md:p-6',
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-2 md:hidden" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
