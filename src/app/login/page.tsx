import type { Metadata } from 'next';
import '@/features/auth/auth.css';
import { LoginScreen } from '@/features/auth/components/LoginScreen';
import { getT } from '@/lib/i18n';

export function generateMetadata(): Metadata {
  const t = getT('auth');
  return { title: t('meta.title'), description: t('meta.description') };
}

// Section I · sign in / create account (demo auth until Supabase auth is switched on)
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <LoginScreen defaultView={mode === 'signup' ? 'signup' : 'signin'} />;
}
