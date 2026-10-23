'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Primary action: panning leaf → teal gradient, a shimmer on hover,
 * and a pulsing glow with an orbit spinner while loading.
 */
export function SubmitButton({
  loading,
  disabled,
  loadingLabel,
  children,
}: {
  loading?: boolean;
  disabled?: boolean;
  loadingLabel: string;
  children: ReactNode;
}) {
  const inactive = disabled || loading;
  return (
    <motion.button
      type="submit"
      disabled={inactive}
      aria-busy={loading || undefined}
      whileHover={inactive ? undefined : { scale: 1.01 }}
      whileTap={inactive ? undefined : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative h-[52px] w-full rounded-2xl"
    >
      <span
        aria-hidden="true"
        className={cn(
          'auth-gradient pointer-events-none absolute -inset-1.5 rounded-[22px] blur-xl transition-opacity duration-500',
          loading ? 'auth-gradient-fast opacity-80' : 'opacity-35 group-hover:opacity-70',
          disabled && !loading && 'opacity-0',
        )}
      />
      {loading && (
        <span
          aria-hidden="true"
          className="auth-glow-pulse pointer-events-none absolute -inset-3 rounded-3xl bg-leaf/35 blur-2xl"
        />
      )}

      <span
        className={cn(
          'auth-gradient relative flex h-full items-center justify-center overflow-hidden rounded-2xl text-[15px] font-bold text-[color:var(--c-on-leaf)]',
          'shadow-[inset_0_1px_0_color-mix(in_srgb,var(--c-on-leaf)_35%,transparent)]',
          disabled && !loading && 'opacity-60 saturate-50',
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[color:var(--c-on-leaf)]/30 to-transparent auth-shimmer opacity-0 group-hover:opacity-100"
        />
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="relative flex items-center gap-3"
            >
              <OrbitSpinner />
              <span>{loadingLabel}</span>
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="relative flex items-center gap-2"
            >
              {children}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

/** Ring spinner with a glowing, pulsing core. */
function OrbitSpinner() {
  return (
    <span aria-hidden="true" className="relative grid size-5 place-items-center">
      <span className="absolute inset-0 rounded-full border-2 border-[color:var(--c-on-leaf)]/25" />
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-[color:var(--c-on-leaf)] border-r-[color:var(--c-on-leaf)]/70"
        animate={{ rotate: 360 }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8, ease: 'linear' }}
      />
      <span className="auth-glow-pulse size-1.5 rounded-full bg-[color:var(--c-on-leaf)] shadow-[0_0_10px_3px_var(--c-lime)]" />
    </span>
  );
}
