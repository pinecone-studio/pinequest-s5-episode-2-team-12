import Link from 'next/link';
import { Logo } from '@/components/brand';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { hasSupabase } from '@/lib/env';
import { getT } from '@/lib/i18n';

export const metadata = { title: 'Нэвтрэх' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = getT('auth');
  return (
    <main className="min-h-dvh gutter py-10 grid content-center justify-items-center paper-grain">
      <div className="w-full max-w-[400px] grid gap-6">
        <Link href="/" className="justify-self-center" aria-label={t('login.back')}>
          <Logo />
        </Link>
        <div className="soft-card p-6 grid gap-5">
          <header className="grid gap-1.5 text-center">
            <h1 className="font-display font-bold text-[24px] text-ink">{t('login.title')}</h1>
            <p className="text-[14px] text-ink-2">{t('login.lead')}</p>
          </header>
          <LoginForm
            configured={hasSupabase()}
            next={typeof sp.next === 'string' ? sp.next : undefined}
            callbackError={sp.error === '1'}
          />
        </div>
      </div>
    </main>
  );
}
