import { notFound } from 'next/navigation';
import Link from 'next/link'; // <-- 1. Link импортлох
import { StopPlayer } from '@/features/roadmap/components/StopPlayer';
import { INTROS } from '@/features/roadmap/content/bank';
import { currentUserId, getHistory, getRoadmap, listStopQuestions } from '@/features/roadmap/queries';
import { stopByNo } from '@/features/roadmap/stops';
import { getT } from '@/lib/i18n';

export const metadata = { title: getT('roadmap')('pages.stop.title') };

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
    <div className="relative min-h-screen bg-background p-4 md:p-6">
      {/* 2. Буцах товч (Байрлалыг өөрийн UI дизайнтайгаа тааруулан өөрчилж болно) */}
      <div className="max-w-5xl mx-auto mb-4">
        <Link
          href="/roadmap" // Roadmap хуудасны руут эсвэл өмнөх хуудас руу чиглүүлэх зам
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-border/40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Буцах
        </Link>
      </div>

      {/* 3. Үндсэн StopPlayer компонент */}
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
    </div>
  );
}