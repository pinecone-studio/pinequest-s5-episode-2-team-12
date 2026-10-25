import { MockExam } from '@/features/exam/components/MockExam';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('exam')('pages.mock.title') };

// Section D · full mock exam («Бүтэн тест»): two adaptive modules, graded on the server.
export default async function MockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, sp] = await Promise.all([getSession().catch(() => null), searchParams]);
  const signedIn = session?.kind === 'user';
  const attempt = typeof sp.attempt === 'string' && signedIn ? sp.attempt : undefined;
  return <MockExam demo={!signedIn} attemptId={attempt} />;
}
