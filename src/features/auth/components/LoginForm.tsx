'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n-client';
import { type AuthResult, enterDemo, sendEmailCode, signInWithGoogle, verifyEmailCode } from '../actions';

const field =
  'h-12 w-full rounded-2xl border border-line bg-paper px-4 text-[15px] text-ink outline-none focus:border-leaf';

export function LoginForm({
  configured,
  next,
  callbackError,
}: {
  configured: boolean;
  next?: string;
  callbackError?: boolean;
}) {
  const t = useT('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(callbackError ? t('login.callbackError') : '');
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<AuthResult>, onOk?: () => void) =>
    start(async () => {
      setError('');
      const r = await fn();
      if (r.ok) onOk?.();
      else setError(r.reason === 'invalid_input' ? t('login.invalid') : t('login.failed'));
    });

  const demo = (
    <form action={enterDemo}>
      <Button type="submit" variant="secondary" size="lg" className="w-full">
        {t('login.demo')}
      </Button>
    </form>
  );

  if (!configured) {
    return (
      <div className="grid gap-4">
        <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
          {t('login.notConfigured')}
        </p>
        {demo}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={pending}
        onClick={() => run(() => signInWithGoogle(next))}
        icon={<GoogleMark />}
      >
        {t('login.google')}
      </Button>

      <div className="flex items-center gap-3 text-[13px] text-ink-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t('login.or')}
        <span className="h-px flex-1 bg-line" />
      </div>

      {!sent ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => sendEmailCode(email),
              () => setSent(true),
            );
          }}
        >
          <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
            {t('login.email')}
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              className={field}
            />
          </label>
          <Button type="submit" size="lg" disabled={pending}>
            {t('login.send')}
          </Button>
        </form>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get('code') ?? '');
            run(() => verifyEmailCode(email, code, next));
          }}
        >
          <p className="text-sm text-ink-2">{t('login.codeSent', { email })}</p>
          <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
            {t('login.code')}
            <input
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6,8}"
              maxLength={8}
              className={`${field} tnum tracking-[0.3em]`}
            />
          </label>
          <Button type="submit" size="lg" disabled={pending}>
            {t('login.verify')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSent(false)}>
            {t('login.changeEmail')}
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

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
