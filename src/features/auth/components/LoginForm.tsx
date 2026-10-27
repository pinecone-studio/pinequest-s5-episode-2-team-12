'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import {
  type AuthResult,
  enterDemo,
  previewOnboarding,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../actions';
import type { AuthFailure } from '../lib/errors';

const field =
  'h-12 w-full rounded-2xl border border-line bg-paper px-4 text-[15px] text-ink outline-none focus:border-leaf';

export function LoginForm({
  configured,
  next,
  callbackError,
  initialMode = 'login',
  googleEnabled = false,
}: {
  configured: boolean;
  next?: string;
  callbackError?: AuthFailure;
  initialMode?: 'login' | 'signup';
  googleEnabled?: boolean;
}) {
  const t = useT('auth');
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [error, setError] = useState(callbackError ? t(`login.errors.${callbackError}`) : '');
  const [errorCode, setErrorCode] = useState('');
  const [failure, setFailure] = useState<AuthFailure | undefined>(callbackError);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<AuthResult>, onOk?: (result: Extract<AuthResult, { ok: true }>) => void) =>
    start(async () => {
      setError('');
      setErrorCode('');
      setFailure(undefined);
      try {
        const r = await fn();
        if (r.ok) onOk?.(r);
        else {
          setFailure(r.reason);
          setError(t(`login.errors.${r.reason}`));
          setErrorCode(r.code ?? '');
        }
      } catch {
        setError(t('login.errors.network'));
      }
    });

  const demo = (
    <form key={mode} action={mode === 'signup' ? previewOnboarding : enterDemo}>
      <Button type="submit" variant="secondary" size="lg" className="w-full">
        {mode === 'signup' ? t('login.previewSetup') : t('login.demo')}
      </Button>
    </form>
  );

  return (
    <div className="grid gap-5">
      <div
        className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-paper-2 p-1"
        role="group"
        aria-label={t('login.title')}
      >
        {(['login', 'signup'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            disabled={pending}
            onClick={() => {
              setMode(value);
              setConfirmationRequired(false);
              setPassword('');
              setError('');
              setErrorCode('');
              setFailure(undefined);
            }}
            className={`rounded-xl px-3 py-3 text-sm font-bold ${mode === value ? 'bg-paper text-ink shadow-sm' : 'text-ink-3'}`}
          >
            {t(value === 'login' ? 'login.signIn' : 'login.signUp')}
          </button>
        ))}
      </div>
      <header className="grid gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">
          {t(mode === 'login' ? 'login.signIn' : 'login.signUp')}
        </h1>
        <p className="text-sm leading-relaxed text-ink-2">
          {t(mode === 'login' ? 'login.signInLead' : 'login.signUpLead')}
        </p>
      </header>
      {!configured && (
        <p role="status" className="rounded-2xl bg-amber-soft p-3 text-xs leading-relaxed text-amber">
          {t('login.notConfigured')}
        </p>
      )}
      {googleEnabled && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending || !configured}
            onClick={() => run(() => signInWithGoogle(next))}
            className="disabled:opacity-50"
            icon={<GoogleMark />}
          >
            {t('login.google')}
          </Button>

          <div className="flex items-center gap-3 text-[13px] text-ink-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t('login.or')}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      {confirmationRequired ? (
        <div
          role="status"
          className="rounded-2xl border border-line bg-sage p-4 text-sm leading-relaxed text-ink"
        >
          {t('login.confirmEmail', { email })}
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                mode === 'signup'
                  ? signUpWithPassword({ email, username, password }, next)
                  : signInWithPassword(email, password, next),
              (result) => {
                if (result.confirmationRequired) {
                  setConfirmationRequired(true);
                  setPassword('');
                }
              },
            );
          }}
        >
          <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
            {t(mode === 'signup' ? 'login.email' : 'login.identifier')}
            <input
              disabled={pending || !configured}
              type={mode === 'signup' ? 'email' : 'text'}
              name={mode === 'signup' ? 'email' : 'identifier'}
              required
              autoComplete={mode === 'signup' ? 'email' : 'username'}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              placeholder={t(mode === 'signup' ? 'login.emailPlaceholder' : 'login.identifierPlaceholder')}
              className={field}
            />
          </label>
          {mode === 'signup' && (
            <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
              {t('login.username')}
              <input
                disabled={pending || !configured}
                name="username"
                aria-label={t('login.username')}
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={1}
                maxLength={40}
                placeholder={t('login.usernamePlaceholder')}
                className={field}
              />
              <span className="text-xs font-normal leading-relaxed text-ink-3">
                {t('login.usernameHint')}
              </span>
            </label>
          )}
          <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
            {t('login.password')}
            <span className="relative block">
              <input
                disabled={pending || !configured}
                type={showPassword ? 'text' : 'password'}
                name="password"
                aria-label={t('login.password')}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === 'signup' ? 8 : 1}
                maxLength={mode === 'signup' ? 72 : 256}
                className={`${field} pr-20`}
              />
              <button
                type="button"
                disabled={pending}
                aria-label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-3 text-xs font-semibold text-leaf-2"
              >
                {t(showPassword ? 'login.hide' : 'login.show')}
              </button>
            </span>
            {mode === 'signup' && (
              <span className="text-xs font-normal text-ink-3">{t('login.passwordHint')}</span>
            )}
          </label>
          {mode === 'login' && (
            <Link
              href={routes.forgotPassword}
              className="justify-self-end text-xs font-semibold text-leaf-2 hover:underline"
            >
              {t('recovery.forgot')}
            </Link>
          )}
          <Button type="submit" size="lg" className="disabled:opacity-50" disabled={pending || !configured}>
            {pending ? t('login.busy') : t(mode === 'signup' ? 'login.createAccount' : 'login.signIn')}
          </Button>
        </form>
      )}

      {error && (
        <div role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
          {(failure === 'account_exists' || failure === 'invalid_credentials') && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {failure === 'account_exists' && mode === 'signup' && (
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => {
                    setMode('login');
                    setPassword('');
                    setConfirmationRequired(false);
                    setError('');
                    setErrorCode('');
                    setFailure(undefined);
                  }}
                >
                  {t('login.useExistingAccount')}
                </button>
              )}
              <Link href={routes.forgotPassword} className="underline underline-offset-4">
                {t('login.resetExistingPassword')}
              </Link>
            </div>
          )}
          {errorCode && (
            <span className="mt-2 block font-mono text-xs font-normal">
              {t('login.errorCode', { code: errorCode })}
            </span>
          )}
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-3">{t('login.passwordPrivacy')}</p>
      <div className="mt-2 border-t border-line pt-4">{demo}</div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.8 3.3-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.7H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7H2.1a11 11 0 0 0 0 9.9z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}
