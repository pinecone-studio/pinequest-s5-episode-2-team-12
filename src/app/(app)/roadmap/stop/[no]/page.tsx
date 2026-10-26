import { notFound } from 'next/navigation';
import { StopPlayer } from '@/features/roadmap/components/StopPlayer';
import { INTROS } from '@/features/roadmap/content/bank';
import { currentUserId, getHistory, getRoadmap, listStopQuestions } from '@/features/roadmap/queries';
import { stopByNo } from '@/features/roadmap/stops';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('roadmap')('pages.stop.title') };

// Section A · one roadmap stop. ?testout=1 starts «Шалгалтаар давах» (strong mastery only); ?intro=1 opens
// the short lesson first («Товч хичээл үзэх» on the stop panel).
export default async function StopPage({
  params,
  searchParams,
}: {
  params: Promise<{ no: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ no: raw }, sp] = await Promise.all([params, searchParams]);
  const no = Number(raw);
  if (!Number.isInteger(no) || !stopByNo(no)) notFound();
  const userId = await currentUserId();
  const [pool, server, history] = await Promise.all([
    listStopQuestions(no),
    userId ? getRoadmap(userId) : Promise.resolve(null),
    userId ? getHistory(userId, no) : Promise.resolve([]),
  ]);
  return (
    <StopPlayer
      no={no}
      testOut={sp.testout === '1'}
      forceIntro={sp.intro === '1'}
      pool={pool}
      intro={INTROS[no] ?? []}
      demo={!userId}
      server={server}
      serverHistory={history}
    />
  );
}
