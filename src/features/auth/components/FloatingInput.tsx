'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert, Eye, EyeOff, LockKeyhole, type LucideIcon } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/cn';

export type FloatingInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> & {
  /** Rests inside the field and floats up on focus or once filled. */
  label: string;
  icon?: LucideIcon;
  /** Translated error text: turns the ring red and is announced via aria-describedby. */
  error?: string;
  /** Shows a green check once the value has passed validation. */
  isValid?: boolean;
  /** Controls at the trailing edge (the password eye). */
  trailing?: ReactNode;
  /** Content under the field (the strength meter). */
  footer?: ReactNode;
};

/**
 * Floating-label input with a gradient focus ring and bloom. The float is pure CSS:
 * placeholder=" " lets peer-placeholder-shown detect an empty field.
 */
export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  { label, icon: Icon, error, isValid, trailing, footer, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);
  const showValid = !hasError && isValid;

  return (
    <div>
      <div
        className={cn(
          'group relative rounded-2xl p-px transition-colors duration-300',
          hasError ? 'bg-danger/60' : 'bg-line-2/80 hover:bg-line-2',
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100',
            hasError ? 'auth-ring-error' : 'auth-ring',
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-1 rounded-[20px] opacity-0 blur-lg transition-opacity duration-300 group-focus-within:opacity-40',
            hasError ? 'auth-ring-error' : 'auth-ring',
          )}
        />

        <div className="relative flex items-center rounded-[15px] bg-paper">
          {Icon && (
            <Icon
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute left-4 size-[18px] transition-colors duration-300',
                hasError ? 'text-danger' : 'text-ink-3 group-focus-within:text-leaf-2',
              )}
            />
          )}

          <input
            ref={ref}
            id={inputId}
            placeholder=" "
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            className={cn(
              'peer h-14 w-full rounded-[15px] bg-transparent pb-2 pt-6 text-[15px] text-ink caret-leaf outline-none',
              'placeholder:text-transparent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
              Icon ? 'pl-11' : 'pl-4',
              trailing ? 'pr-[4.5rem]' : 'pr-11',
              className,
            )}
            {...props}
          />

          <label
            htmlFor={inputId}
            className={cn(
              'pointer-events-none absolute top-2 origin-left select-none text-[11px] font-semibold tracking-wide transition-all duration-200 ease-out',
              'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal',
              'peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:tracking-wide',
              hasError ? 'text-danger' : 'text-ink-3 peer-focus:text-leaf-2',
              Icon ? 'left-11' : 'left-4',
            )}
          >
            {label}
          </label>

          <div className="absolute right-2 flex items-center gap-0.5">
            <AnimatePresence initial={false}>
              {(hasError || showValid) && (
                <motion.span
                  key={hasError ? 'error' : 'valid'}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="grid size-7 place-items-center"
                >
                  {hasError ? (
                    <CircleAlert aria-hidden="true" className="size-[17px] text-danger" />
                  ) : (
                    <span className="grid size-[18px] place-items-center rounded-full bg-sage ring-1 ring-leaf/50">
                      <Check aria-hidden="true" className="size-3 text-leaf-2" strokeWidth={3} />
                    </span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
            {trailing}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {hasError && (
          <motion.p
            key="error"
            id={errorId}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden pl-1 text-[13px] font-medium text-danger"
          >
            <span className="block pt-1.5">{error}</span>
          </motion.p>
        )}
      </AnimatePresence>

      {footer}
    </div>
  );
});

type PasswordInputProps = Omit<FloatingInputProps, 'type' | 'trailing'> & {
  showLabel: string;
  hideLabel: string;
};

/** FloatingInput with a show / hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { icon = LockKeyhole, showLabel, hideLabel, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <FloatingInput
      ref={ref}
      {...props}
      icon={icon}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="grid size-9 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={visible ? 'hide' : 'show'}
              initial={{ opacity: 0, rotate: -45, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              className="grid place-items-center"
            >
              {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </button>
      }
    />
  );
});
