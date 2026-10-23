'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { passwordChecks, passwordScore } from '../lib/validation';

const SEGMENT = ['bg-danger', 'bg-amber', 'bg-leaf', 'bg-teal'];
const LABEL = ['text-ink-3', 'text-danger', 'text-amber', 'text-leaf-2', 'text-teal'];

/** Four-segment strength meter + rule checklist, shown while choosing a new password. */
export function PasswordStrength({ password }: { password: string }) {
  const t = useT('auth');
  const score = passwordScore(password);
  const checks = passwordChecks(password);

  return (
    <AnimatePresence initial={false}>
      {password.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
          aria-live="polite"
          data-testid="password-strength"
        >
          <div className="space-y-2.5 px-1 pt-3">
            <div className="flex items-center gap-3">
              <div className="grid flex-1 grid-cols-4 gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-1.5 overflow-hidden rounded-full bg-line">
                    <motion.div
                      className={cn('h-full origin-left rounded-full', SEGMENT[score - 1])}
                      initial={false}
                      animate={{ scaleX: i < score ? 1 : 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: i * 0.04 }}
                    />
                  </div>
                ))}
              </div>
              <span
                className={cn(
                  'min-w-16 shrink-0 whitespace-nowrap text-right font-mono text-[11px] font-bold uppercase tracking-wider',
                  LABEL[score],
                )}
              >
                {t(`password.strength.${score}`)}
              </span>
            </div>

            <ul className="flex flex-wrap gap-1.5">
              {checks.map((check) => (
                <li
                  key={check.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors duration-300',
                    check.met ? 'border-leaf/40 bg-sage text-leaf-2' : 'border-line bg-paper-2 text-ink-3',
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn('size-3 transition-opacity', check.met ? 'opacity-100' : 'opacity-30')}
                  />
                  {t(`password.rules.${check.id}`)}
                  <span className="sr-only">
                    {t(check.met ? 'password.rules.met' : 'password.rules.unmet')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
