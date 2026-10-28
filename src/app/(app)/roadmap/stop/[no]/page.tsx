import { notFound } from 'next/navigation';
import Link from 'next/link';
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
    <div className="relative max-h-dvh bg-background text-foreground flex flex-col justify-between p-4 md:p-8 overflow-x-hidden">
      {/* Дэлгэцийг бүтэн дүүргэх Full Fixed Background Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none z-0" />

      {/* Header: Дээд талын навигаци (Бүтэн өргөнөөр байрлана) */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between py-2 mb-6">
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all border border-border/40 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Зам руу буцах</span>
        </Link>

        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 px-3.5 py-1.5 rounded-full border border-border/30 shadow-sm">
          Даалгавар #{no}
        </div>
      </header>

      {/* Main Content Area: max-w-4xl гэдгийг болиулж илүү уужим зайтай болгосон */}
      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center my-auto">
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
      </main>
    </div>
  );
}