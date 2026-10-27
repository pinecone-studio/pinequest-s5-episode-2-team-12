import Link from 'next/link';
import { Logo } from '@/components/brand';
import { MascotArt } from '@/components/brand/MascotArt';
import { LoginForm } from '@/features/auth/components/LoginForm';
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
    <main className="shell-bg min-h-dvh gutter py-8 sm:py-12 grid content-center">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px] lg:gap-16">
        <section className="grid justify-items-start gap-6">
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
          <div className="hidden lg:grid size-28 place-items-center rounded-3xl border border-line bg-paper/70">
            <MascotArt size={76} />
          </div>
        </section>
        <section className="soft-card p-6 sm:p-8">
          <LoginForm
            configured={hasSupabase()}
            googleEnabled={await hasGoogleProvider()}
            next={typeof sp.next === 'string' ? sp.next : undefined}
            callbackError={sp.error === '1'}
            initialMode={sp.mode === 'signup' ? 'signup' : 'login'}
          />
        </section>
      </div>
    </main>
  );
}
