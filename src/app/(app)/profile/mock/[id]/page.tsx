import { mockBank } from '@/features/exam/engine';
import { listMockAttempts } from '@/features/exam/mock-queries';
import { MockResult } from '@/features/profile/components/MockResult';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';
import type { Question } from '@/types';

export const metadata = { title: getT('profile')('result.title') };

export default async function MockResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession().catch(() => null);
  const userId = session?.kind === 'user' ? session.userId : null;
  const attempts = userId ? await listMockAttempts(userId).catch(() => []) : [];
  const attempt = attempts.find((a) => a.id === id);
  const { bank } = mockBank();
  // signed in: the finished attempt is the student's own (RLS), so its answers can be shown
  const questions = attempt
    ? attempt.modules
        .flatMap((m) => m.ids)
        .map((q) => bank.get(q))
        .filter((q): q is Question => Boolean(q))
    : [];
  return <MockResult id={id} demo={!userId} attempts={attempts} questions={questions} />;
}
