'use client';
import { motion } from 'framer-motion';
import { type KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';

export type AuthMode = 'signin' | 'signup';

const MODES: AuthMode[] = ['signin', 'signup'];

/** Sign In / Create Account switch with a spring-animated thumb. Arrow keys move between tabs. */
export function AuthTabs({
  idPrefix,
  panelId,
  mode,
  onChange,
  disabled,
}: {
  /** Tab ids become `${idPrefix}-tab-signin` / `-signup`. */
  idPrefix: string;
  panelId: string;
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
  disabled?: boolean;
}) {
  const t = useT('auth');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = (MODES.indexOf(mode) + (e.key === 'ArrowRight' ? 1 : -1) + MODES.length) % MODES.length;
    onChange(MODES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t('tabs.label')}
      onKeyDown={handleKeyDown}
      className="relative grid grid-cols-2 rounded-2xl border border-line bg-paper-2/80 p-1"
    >
      {MODES.map((id, i) => {
        const active = id === mode;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${id}`}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              'relative h-10 rounded-xl text-sm font-bold transition-colors duration-300 disabled:cursor-not-allowed',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId="auth-tab-thumb"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-xl border border-line bg-paper shadow-[0_8px_24px_-10px_var(--c-leaf)]"
              >
                <span className="absolute inset-x-6 -bottom-px h-px bg-gradient-to-r from-transparent via-leaf to-transparent" />
              </motion.span>
            )}
            <span className="relative">{t(`tabs.${id}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
