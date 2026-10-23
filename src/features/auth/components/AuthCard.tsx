'use client';
import { AnimatePresence, MotionConfig, motion, useAnimationControls, type Variants } from 'framer-motion';
import { ArrowLeft, AtSign, CircleAlert, Info, MailCheck, UserRound } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Logo } from '@/components/brand/Decor';
import { useT } from '@/lib/i18n-client';
import {
  AuthError,
  type AuthService,
  type AuthUser,
  DEMO_TRIGGERS,
  demoAuth,
  type SocialProvider,
} from '../lib/demo-auth';
import {
  type AuthErrors,
  type AuthField,
  type AuthValues,
  type AuthView,
  type ErrorCode,
  VIEW_FIELDS,
  validateAuth,
} from '../lib/validation';
import { AnimatedHeight } from './AnimatedHeight';
import { type AuthMode, AuthTabs } from './AuthTabs';
import { FloatingInput, PasswordInput } from './FloatingInput';
import { GlassPanel } from './GlassPanel';
import { GlowCheckbox } from './GlowCheckbox';
import { PasswordStrength } from './PasswordStrength';
import { AuthDivider, PROVIDER_NAMES, SocialButtons } from './SocialButtons';
import { SubmitButton } from './SubmitButton';
import { SuccessState } from './SuccessState';

const EASE = [0.22, 1, 0.36, 1] as const;
export const REMEMBER_KEY = 'suprep-remembered-email';

/** Slide direction: reset sits "to the right" of sign-in, like sign-up. */
const VIEW_ORDER: Record<AuthView, number> = { signin: 0, signup: 1, reset: 1 };

const INITIAL_VALUES: AuthValues = { name: '', email: '', password: '', remember: true, terms: false };

const panelVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 36, filter: 'blur(6px)' }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.34, ease: EASE, staggerChildren: 0.05, delayChildren: 0.03 },
  },
  exit: (dir: number) => ({ opacity: 0, x: dir * -36, filter: 'blur(6px)', transition: { duration: 0.2 } }),
};

const rowVariants: Variants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
  exit: { opacity: 0 },
};

type Status = 'idle' | 'loading' | 'success';

export type AuthCardProps = {
  defaultView?: AuthMode;
  /** Defaults to demo mode. Pass a Supabase-backed service when going live. */
  service?: AuthService;
  /** Shows the demo hint under the card. */
  demo?: boolean;
  /** Called with routes.dashboard after a successful sign-in (the page passes router.push). */
  onRedirect?: (href: string) => void;
};

export function AuthCard({
  defaultView = 'signin',
  service = demoAuth,
  demo = true,
  onRedirect,
}: AuthCardProps) {
  const t = useT('auth');
  const uid = useId();
  const panelId = `${uid}-panel`;
  const [view, setView] = useState<AuthView>(defaultView);
  const [direction, setDirection] = useState(1);
  const [values, setValues] = useState<AuthValues>(INITIAL_VALUES);
  const [touched, setTouched] = useState<Partial<Record<AuthField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<AuthErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const shake = useAnimationControls();
  const fieldRefs = useRef<Partial<Record<AuthField, HTMLInputElement | null>>>({});
  const busy = status === 'loading';

  // "Remember me": restore the saved email
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) setValues((v) => ({ ...v, email: saved, remember: true }));
    } catch {
      // storage blocked (private mode): start empty
    }
  }, []);

  // Client rules show once a field is touched; errors from the service always show.
  const clientErrors = useMemo(() => validateAuth(view, values), [view, values]);
  const codeFor = (field: AuthField): ErrorCode | undefined =>
    serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);
  const errorFor = (field: AuthField) => {
    const code = codeFor(field);
    return code ? t(`errors.${code}`) : undefined;
  };
  const isValid = (field: AuthField) => Boolean(touched[field] && values[field] && !codeFor(field));

  const goTo = (next: AuthView) => {
    if (next === view || busy) return;
    setDirection(VIEW_ORDER[next] >= VIEW_ORDER[view] ? 1 : -1);
    setView(next);
    setTouched({});
    setServerErrors({});
    setFormError(null);
    setResetSentTo(null);
  };

  const setField = <K extends AuthField>(field: K, value: AuthValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (serverErrors[field]) {
      setServerErrors((errs) => {
        const next = { ...errs };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  const bindText = (field: 'name' | 'email' | 'password') => ({
    ref: (el: HTMLInputElement | null) => {
      fieldRefs.current[field] = el;
    },
    id: `${uid}-${field}`,
    name: field,
    value: values[field],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setField(field, e.target.value),
    onBlur: () => setTouched((tch) => ({ ...tch, [field]: true })),
    error: errorFor(field),
    disabled: busy,
  });

  const runShake = () => shake.start({ x: [0, -10, 9, -6, 5, -2, 0], transition: { duration: 0.45 } });

  const persistRemember = (email: string) => {
    try {
      if (values.remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // storage blocked: nothing to remember
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;

    const fields = VIEW_FIELDS[view];
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    setServerErrors({});
    setFormError(null);

    const errors = validateAuth(view, values);
    const firstInvalid = fields.find((f) => errors[f]);
    if (firstInvalid) {
      runShake();
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    setStatus('loading');
    try {
      if (view === 'reset') {
        await service.requestPasswordReset(values.email.trim());
        setResetSentTo(values.email.trim());
        setStatus('idle');
        return;
      }
      const result =
        view === 'signin'
          ? await service.signIn({ email: values.email, password: values.password })
          : await service.signUp({ name: values.name, email: values.email, password: values.password });
      if (view === 'signin') persistRemember(values.email.trim());
      setUser(result);
      setStatus('success');
    } catch (err) {
      setStatus('idle');
      if (err instanceof AuthError && err.field !== 'form') {
        setServerErrors({ [err.field]: err.code });
        fieldRefs.current[err.field]?.focus();
      } else {
        setFormError(t(`errors.${err instanceof AuthError ? err.code : 'generic'}`));
      }
      runShake();
    }
  };

  const handleSocial = async (provider: SocialProvider) => {
    if (busy) return;
    setFormError(null);
    setPendingProvider(provider);
    setStatus('loading');
    try {
      setUser(await service.signInWithProvider(provider));
      setStatus('success');
    } catch {
      setStatus('idle');
      setFormError(t('errors.social', { provider: PROVIDER_NAMES[provider] }));
    } finally {
      setPendingProvider(null);
    }
  };

  const resetDemo = () => {
    setStatus('idle');
    setUser(null);
    setValues((v) => ({ ...INITIAL_VALUES, email: v.remember ? v.email : '', remember: v.remember }));
    setTouched({});
    setDirection(-1);
    setView('signin');
  };

  const linkClass = 'rounded font-bold text-leaf-2 transition-colors hover:text-leaf';

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
        className="mx-auto w-full max-w-[460px] lg:mr-0 lg:ml-auto"
      >
        <GlassPanel>
          {/* the shake lives outside the variant tree so it never interrupts the staggered rows */}
          <motion.div animate={shake} className="p-6 sm:p-8">
            <div className="mb-6 lg:hidden">
              <Logo compact={false} />
            </div>

            <AnimatedHeight>
              <AnimatePresence mode="wait" initial={false}>
                {status === 'success' && user ? (
                  <SuccessState
                    key="success"
                    user={user}
                    variant={view === 'signup' ? 'signup' : 'signin'}
                    onRedirect={onRedirect}
                    onReset={resetDemo}
                  />
                ) : (
                  <motion.div key="auth" exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }}>
                    <AnimatePresence initial={false}>
                      {view !== 'reset' && (
                        <motion.div
                          key="tabs"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                        >
                          <div className="pb-7">
                            <AuthTabs
                              idPrefix={uid}
                              panelId={panelId}
                              mode={view as AuthMode}
                              onChange={goTo}
                              disabled={busy}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait" custom={direction} initial={false}>
                      <motion.div
                        key={view}
                        id={panelId}
                        role={view === 'reset' ? undefined : 'tabpanel'}
                        aria-labelledby={view === 'reset' ? undefined : `${uid}-tab-${view}`}
                        custom={direction}
                        variants={panelVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                      >
                        {view === 'reset' && (
                          <motion.button
                            variants={rowVariants}
                            type="button"
                            onClick={() => goTo('signin')}
                            disabled={busy}
                            className="mb-5 inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
                          >
                            <ArrowLeft aria-hidden="true" className="size-4" /> {t('back')}
                          </motion.button>
                        )}

                        <motion.div variants={rowVariants} className="mb-6">
                          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
                            {t(`views.${view}.title`)}
                          </h1>
                          <p className="mt-1.5 text-sm text-ink-2">{t(`views.${view}.subtitle`)}</p>
                        </motion.div>

                        {view === 'reset' && resetSentTo ? (
                          <ResetSent
                            email={resetSentTo}
                            onBack={() => goTo('signin')}
                            onOther={() => setResetSentTo(null)}
                          />
                        ) : (
                          <form onSubmit={handleSubmit} noValidate className="space-y-4">
                            <AnimatePresence initial={false}>
                              {formError && (
                                <motion.div
                                  role="alert"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger">
                                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                    {formError}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {view === 'signup' && (
                              <motion.div variants={rowVariants}>
                                <FloatingInput
                                  {...bindText('name')}
                                  label={t('fields.name')}
                                  icon={UserRound}
                                  autoComplete="name"
                                  isValid={isValid('name')}
                                />
                              </motion.div>
                            )}

                            <motion.div variants={rowVariants}>
                              <FloatingInput
                                {...bindText('email')}
                                label={t('fields.email')}
                                type="email"
                                inputMode="email"
                                icon={AtSign}
                                autoComplete="email"
                                isValid={isValid('email')}
                              />
                            </motion.div>

                            {view !== 'reset' && (
                              <motion.div variants={rowVariants}>
                                <PasswordInput
                                  {...bindText('password')}
                                  label={t('fields.password')}
                                  showLabel={t('password.show')}
                                  hideLabel={t('password.hide')}
                                  autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                                  isValid={view === 'signup' && isValid('password')}
                                  footer={
                                    view === 'signup' ? (
                                      <PasswordStrength password={values.password} />
                                    ) : undefined
                                  }
                                />
                              </motion.div>
                            )}

                            {view === 'signin' && (
                              <motion.div
                                variants={rowVariants}
                                className="flex flex-wrap items-center justify-between gap-2 pt-0.5"
                              >
                                <GlowCheckbox
                                  checked={values.remember}
                                  onChange={(checked) => setField('remember', checked)}
                                >
                                  {t('remember')}
                                </GlowCheckbox>
                                <button
                                  type="button"
                                  onClick={() => goTo('reset')}
                                  className={`text-sm ${linkClass}`}
                                >
                                  {t('forgot')}
                                </button>
                              </motion.div>
                            )}

                            {view === 'signup' && (
                              <motion.div variants={rowVariants} className="pt-0.5">
                                <GlowCheckbox
                                  checked={values.terms}
                                  onChange={(checked) => {
                                    setField('terms', checked);
                                    setTouched((tch) => ({ ...tch, terms: true }));
                                  }}
                                  error={errorFor('terms')}
                                >
                                  {t('terms')}
                                </GlowCheckbox>
                              </motion.div>
                            )}

                            <motion.div variants={rowVariants} className="pt-2">
                              <SubmitButton
                                loading={busy && !pendingProvider}
                                disabled={busy}
                                loadingLabel={t(`views.${view}.loading`)}
                              >
                                {t(`views.${view}.cta`)}
                              </SubmitButton>
                            </motion.div>
                          </form>
                        )}

                        {view !== 'reset' && (
                          <>
                            <motion.div variants={rowVariants} className="my-6">
                              <AuthDivider label={t('divider')} />
                            </motion.div>
                            <motion.div variants={rowVariants}>
                              <SocialButtons
                                onSelect={handleSocial}
                                pending={pendingProvider}
                                disabled={busy}
                              />
                            </motion.div>
                            <motion.p variants={rowVariants} className="mt-7 text-center text-sm text-ink-3">
                              {t(view === 'signin' ? 'switch.toSignupPrompt' : 'switch.toSigninPrompt')}{' '}
                              <button
                                type="button"
                                onClick={() => goTo(view === 'signin' ? 'signup' : 'signin')}
                                disabled={busy}
                                className={linkClass}
                              >
                                {t(view === 'signin' ? 'switch.toSignup' : 'switch.toSignin')}
                              </button>
                            </motion.p>
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </AnimatedHeight>
          </motion.div>
        </GlassPanel>

        {demo && (
          <p className="mt-5 flex items-start justify-center gap-2 px-2 text-center text-xs leading-relaxed text-ink-3">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {t('demo.hint', { wrong: DEMO_TRIGGERS.wrongPassword, taken: DEMO_TRIGGERS.takenEmail })}
            </span>
          </p>
        )}
      </motion.div>
    </MotionConfig>
  );
}

function ResetSent({ email, onBack, onOther }: { email: string; onBack: () => void; onOther: () => void }) {
  const t = useT('auth');
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      role="status"
      className="rounded-2xl border border-sage-2 bg-sage p-5"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper ring-1 ring-sage-2">
          <MailCheck aria-hidden="true" className="size-5 text-leaf-2" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-ink">{t('resetSent.title')}</p>
          <p className="mt-1 break-words text-sm text-ink-2">{t('resetSent.body', { email })}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-sage-2 pt-4 text-sm">
        <button
          type="button"
          onClick={onOther}
          className="rounded text-ink-2 transition-colors hover:text-ink"
        >
          {t('resetSent.other')}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded font-bold text-leaf-2 transition-colors hover:text-leaf"
        >
          {t('back')}
        </button>
      </div>
    </motion.div>
  );
}
