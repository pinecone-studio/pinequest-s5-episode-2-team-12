'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';

type GlowCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
};

/** A real checkbox (visually hidden) with a gradient fill and a drawn tick. */
export function GlowCheckbox({ checked, onChange, children, error }: GlowCheckboxProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label
        htmlFor={id}
        className="group inline-flex cursor-pointer select-none items-start gap-2.5 text-sm text-ink-2"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative mt-px grid size-[18px] shrink-0 place-items-center rounded-[6px] border-[1.5px] transition-all duration-200',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-leaf peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-paper',
            checked
              ? 'auth-ring border-transparent shadow-[0_0_14px_-2px_var(--c-leaf)]'
              : error
                ? 'border-danger bg-danger-soft'
                : 'border-line-2 bg-paper group-hover:border-ink-3',
          )}
        >
          <AnimatePresence initial={false}>
            {checked && (
              <motion.svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-3 text-paper"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
        <span className="leading-5 transition-colors group-hover:text-ink">{children}</span>
      </label>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pl-7 text-[13px] font-medium text-danger"
          >
            <span className="block pt-1">{error}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
