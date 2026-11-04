import { MockExam } from '@/features/exam/components/MockExam';
import { availableForms } from '@/features/exam/forms';
import { listMockAttempts } from '@/features/exam/mock-queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('exam')('pages.mock.title') };

// Section D · full mock exam («Mock тест»): the fixed practice tests (Bluebook-style forms) and the random
// adaptive mock; two modules, graded on the server.
export default async function MockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, sp] = await Promise.all([getSession().catch(() => null), searchParams]);
  const signedIn = session?.kind === 'user';
  const attempt = typeof sp.attempt === 'string' && signedIn ? sp.attempt : undefined;
  const best: Record<string, number> = {};
  if (signedIn) {
    for (const a of await listMockAttempts(session.userId).catch(() => []))
      if (a.formId && a.score !== null) best[a.formId] = Math.max(best[a.formId] ?? 0, a.score);
  }
  return <MockExam demo={!signedIn} attemptId={attempt} forms={availableForms()} best={best} />;
}
