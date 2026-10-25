import { MockExam } from '@/features/exam/components/MockExam';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('exam')('pages.mock.title') };

// Section D · full mock exam («Бүтэн тест»): two adaptive modules, graded on the server.
export default async function MockPage() {
  const session = await getSession().catch(() => null);
  return <MockExam demo={session?.kind !== 'user'} />;
}
