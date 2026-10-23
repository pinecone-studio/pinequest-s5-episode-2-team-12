'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, House, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { AuthUser } from '../lib/demo-auth';

const SPARKS = Array.from({ length: 10 }, (_, i) => i);
const STATS = [
  { key: 'streak', width: '62%' },
  { key: 'mastery', width: '78%' },
  { key: 'next', width: '40%' },
] as const;

/**
 * After auth: a drawn check with a particle burst, a personal greeting, and a banner that
 * counts down and then calls onRedirect(routes.dashboard).
 */
export function SuccessState({
  user,
  variant,
  countdown = 4,
  onRedirect,
  onReset,
}: {
  user: AuthUser;
  variant: 'signin' | 'signup';
  countdown?: number;
  onRedirect?: (href: string) => void;
  onReset: () => void;
}) {
  const t = useT('auth');
  const reduceMotion = useReducedMotion();
  const [remaining, setRemaining] = useState(countdown);
  const firstName = user.name.split(' ')[0] || user.name;
  const done = remaining <= 0;

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  useEffect(() => {
    if (done) onRedirect?.(routes.dashboard);
  }, [done, onRedirect]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative mt-2 mb-6 grid size-24 place-items-center">
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-leaf/40 blur-2xl"
          animate={reduceMotion ? undefined : { scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        {!reduceMotion &&
          SPARKS.map((i) => {
            const angle = (i / SPARKS.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                aria-hidden="true"
                className={
                  i % 2 ? 'absolute size-1.5 rounded-full bg-lime' : 'absolute size-1.5 rounded-full bg-teal'
                }
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: Math.cos(angle) * 64,
                  y: Math.sin(angle) * 64,
                  opacity: [0, 1, 0],
                  scale: [0, 1.2, 0.4],
                }}
                transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
              />
            );
          })}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="auth-ring relative grid size-20 place-items-center rounded-full p-[2px] shadow-[0_0_40px_-4px_var(--c-leaf)]"
        >
          <div className="grid size-full place-items-center rounded-full bg-paper">
            <svg viewBox="0 0 24 24" fill="none" className="size-9 text-leaf" aria-hidden="true">
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.45, delay: 0.2, ease: 'easeOut' }}
              />
            </svg>
          </div>
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="font-display text-2xl font-bold tracking-tight text-ink"
      >
        {t(variant === 'signup' ? 'success.welcome' : 'success.welcomeBack', { name: firstName })}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="mt-2 max-w-xs text-balance text-sm text-ink-2"
      >
        {t(variant === 'signup' ? 'success.signupBody' : 'success.signinBody')}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-7 w-full overflow-hidden rounded-2xl border border-line bg-paper-2 text-left"
      >
        <div className="flex items-center gap-3 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage ring-1 ring-sage-2">
            <House aria-hidden="true" className="size-5 text-leaf-2" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{t(done ? 'success.ready' : 'success.redirecting')}</p>
            <p className="truncate font-mono text-xs text-ink-3">
              {routes.dashboard} ·{' '}
              <span className="tnum">{t('success.seconds', { n: Math.max(remaining, 0) })}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRedirect?.(routes.dashboard)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-leaf-2 transition-colors hover:bg-sage"
          >
            {t('success.goNow')} <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
        <div className="h-1 w-full bg-line">
          <motion.div
            className="auth-ring h-full origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: countdown, ease: 'linear' }}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        aria-hidden="true"
        className="mt-3 grid w-full grid-cols-3 gap-2"
      >
        {STATS.map(({ key, width }, i) => (
          <div key={key} className="rounded-xl border border-line bg-paper p-3 text-left">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-ink-3">
              {t(`success.stats.${key}`)}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <motion.div
                className="auth-ring h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width }}
                transition={{ delay: 0.8 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </motion.div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink-2"
      >
        <RotateCcw aria-hidden="true" className="size-3.5" /> {t('success.restart')}
      </button>
    </motion.div>
  );
}
