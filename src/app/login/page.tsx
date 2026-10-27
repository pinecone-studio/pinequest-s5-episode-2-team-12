import Link from 'next/link';
import { Logo } from '@/components/brand';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { callbackFailure } from '@/features/auth/lib/errors';
import { hasGoogleProvider } from '@/features/auth/providers';
import { hasSupabase } from '@/lib/env';
import { getT } from '@/lib/i18n';
import { routes } from '@/lib/routes';

export const metadata = { title: 'Нэвтрэх · Бүртгүүлэх' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = getT('auth');
  return (
    <main className="emerald-workspace auth-workspace min-h-dvh gutter py-8 sm:py-12 grid content-center">
      <div className="mx-auto grid w-full max-w-6xl items-stretch gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
        <section className="auth-story grid content-start justify-items-start gap-6">
          <Link href={routes.home} aria-label="SuPrep">
            <Logo />
          </Link>
          <h2 className="max-w-[18ch] font-display text-3xl sm:text-4xl font-bold leading-tight text-ink">
            {t('login.heroTitle')}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-ink-2">{t('login.heroLead')}</p>
          <ul className="hidden sm:grid gap-3 text-sm text-ink-2">
            {['map', 'practice', 'progress'].map((key) => (
              <li key={key} className="flex gap-3">
                <span aria-hidden="true" className="text-leaf-2">
                  ✓
                </span>
                {t(`login.benefits.${key}`)}
              </li>
            ))}
          </ul>
        </section>
        <section className="auth-form-panel soft-card p-6 sm:p-10">
          {sp.password === 'updated' && (
            <p role="status" className="mb-5 rounded-xl border border-line bg-sage p-4 text-sm text-ink">
              {t('recovery.updated')}
            </p>
          )}
          <LoginForm
            configured={hasSupabase()}
            googleEnabled={await hasGoogleProvider()}
            next={typeof sp.next === 'string' ? sp.next : undefined}
            callbackError={callbackFailure(sp.error)}
            initialMode={sp.mode === 'signup' ? 'signup' : 'login'}
          />
        </section>
      </div>
    </main>
  );
}
