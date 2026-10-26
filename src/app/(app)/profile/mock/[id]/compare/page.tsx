import { listMockAttempts } from '@/features/exam/mock-queries';
import { MockCompare } from '@/features/profile/components/MockCompare';
import { questionMeta } from '@/features/profile/queries';
import { getT } from '@/lib/i18n';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('profile')('compare.title') };

export default async function MockComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const session = await getSession().catch(() => null);
  const userId = session?.kind === 'user' ? session.userId : null;
  const attempts = userId ? await listMockAttempts(userId).catch(() => []) : [];
  return (
    <MockCompare
      id={id}
      withId={typeof sp.with === 'string' ? sp.with : null}
      demo={!userId}
      attempts={attempts}
      meta={questionMeta()}
    />
  );
}
