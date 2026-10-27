'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { requestPasswordReset, updatePassword } from '../actions';
import type { AuthFailure } from '../lib/errors';

const field = 'h-12 w-full rounded-xl border border-line bg-paper px-4 text-sm text-ink';
export function RecoveryForm({
  mode,
  configured,
  allowed = true,
  initialError,
}: {
  mode: 'request' | 'update';
  configured: boolean;
  allowed?: boolean;
  initialError?: AuthFailure;
}) {
  const t = useT('auth');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError ? t(`login.errors.${initialError}`) : '');
  const [code, setCode] = useState('');
  const [pending, start] = useTransition();
  const [show, setShow] = useState(false);
  const updating = mode === 'update';
  const submit = (form: HTMLFormElement) => {
    const values = new FormData(form);
    if (updating && values.get('password') !== values.get('confirmPassword')) {
      setError(t('login.errors.password_mismatch'));
      return;
    }
    start(async () => {
      setError('');
      setCode('');
      try {
        const result = updating
          ? await updatePassword({
              password: values.get('password'),
              confirmPassword: values.get('confirmPassword'),
            })
          : await requestPasswordReset(String(values.get('email') ?? ''));
        if (result.ok) {
          setSent(true);
          form.reset();
        } else {
          setError(t(`login.errors.${result.reason}`));
          setCode(result.code ?? '');
        }
      } catch {
        setError(t('login.errors.network'));
      }
    });
  };
  return (
    <div className="grid gap-5">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold text-ink">
          {t(updating ? 'recovery.updateTitle' : 'recovery.title')}
        </h1>
        <p className="text-sm leading-relaxed text-ink-2">
          {t(updating ? 'recovery.updateLead' : 'recovery.lead')}
        </p>
      </header>
      {updating && !allowed ? (
        <div className="grid gap-4">
          <p role="alert" className="rounded-xl bg-amber-soft p-4 text-sm text-amber">
            {t('login.errors.recovery_required')}
          </p>
          <Link
            href={routes.forgotPassword}
            className="font-semibold text-leaf-2 underline underline-offset-4"
          >
            {t('recovery.requestNew')}
          </Link>
        </div>
      ) : sent ? (
        <p
          role="status"
          className="rounded-xl border border-line bg-sage p-4 text-sm leading-relaxed text-ink"
        >
          {t(updating ? 'recovery.updated' : 'recovery.sent')}
        </p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit(event.currentTarget);
          }}
        >
          {updating ? (
            <>
              <label className="grid gap-2 text-sm font-semibold text-ink-2">
                {t('recovery.newPassword')}
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  disabled={pending || !configured}
                  className={field}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink-2">
                {t('recovery.confirmPassword')}
                <input
                  name="confirmPassword"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  disabled={pending || !configured}
                  className={field}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} />
                {t('login.showPassword')}
              </label>
              <p className="text-xs text-ink-3">{t('login.passwordHint')}</p>
            </>
          ) : (
            <label className="grid gap-2 text-sm font-semibold text-ink-2">
              {t('login.email')}
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                disabled={pending || !configured}
                placeholder={t('login.emailPlaceholder')}
                className={field}
              />
            </label>
          )}
          <Button type="submit" size="lg" disabled={pending || !configured}>
            {pending ? t('login.busy') : t(updating ? 'recovery.save' : 'recovery.send')}
          </Button>
        </form>
      )}
      {!configured && (
        <p role="status" className="text-sm text-amber">
          {t('login.notConfigured')}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">
          {error}
          {code && <span className="mt-2 block font-mono text-xs">{t('login.errorCode', { code })}</span>}
        </p>
      )}
      <Link href={routes.login()} className="text-center text-sm font-semibold text-leaf-2 hover:underline">
        {t('recovery.back')}
      </Link>
    </div>
  );
}
