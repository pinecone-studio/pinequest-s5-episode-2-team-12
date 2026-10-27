import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand';
import { getProfile } from '@/features/home/queries';
import { OnboardingForm } from '@/features/onboarding/components/OnboardingForm';
import { safeNext } from '@/lib/auth-gate';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';
import { dayKey } from '@/lib/time';

export const metadata = { title: getT('onboarding')('title') };
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login?mode=signup');
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === 'string' ? sp.next : '/');
  if (session.kind === 'user' && !session.anonymous) {
    const profile = await getProfile().catch(() => null);
    if (profile?.onboarded)
      redirect(next.startsWith('/onboarding') || next.startsWith('/login') ? '/' : next);
  }
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8">
      <div className="justify-self-center">
        <Logo />
      </div>
      <OnboardingForm demo={session.kind === 'demo'} today={dayKey()} next={next} />
    </div>
  );
}
