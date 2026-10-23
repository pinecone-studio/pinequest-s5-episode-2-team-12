'use client';
import { type PointerEvent, type ReactNode, useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Frosted card with a spotlight that follows the pointer on the fill and the 1px border.
 * The pointer position goes straight into CSS variables, so moving the mouse never re-renders.
 */
export function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn('auth-glass group/glass relative rounded-[28px]', className)}
    >
      {/* glowing top hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-12 -top-px h-px bg-gradient-to-r from-transparent via-leaf to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-24 -top-3 h-6 bg-leaf/25 blur-xl"
      />
      <div
        aria-hidden="true"
        className="auth-spot-fill pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/glass:opacity-100"
      />
      <div
        aria-hidden="true"
        className="auth-spot-ring pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/glass:opacity-100"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
