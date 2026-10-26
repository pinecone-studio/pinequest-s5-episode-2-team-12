import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';
import { MockExam as MockIntro } from './MockExam';

export const metadata = { title: getT('exam')('pages.mock.title') };

// «Mock тест» intro: lives inside the app shell (nav + profile).
// The exam itself runs at /mock/run (no nav). Old group-mock links /mock?attempt=… still work.
export default async function MockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, sp] = await Promise.all([getSession().catch(() => null), searchParams]);
  const signedIn = session?.kind === 'user';

  if (typeof sp.attempt === 'string' && signedIn) {
    redirect(`/mock/run?attempt=${encodeURIComponent(sp.attempt)}`);
  }

  return <MockIntro demo={!signedIn} />;
}
