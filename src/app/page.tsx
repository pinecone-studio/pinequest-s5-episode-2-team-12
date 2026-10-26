import Link from 'next/link';
import { Logo } from '@/components/brand';
import { AppShell } from '@/components/shell/AppShell';
import { loadShell } from '@/components/shell/load-shell';
import { enterDemo } from '@/features/auth/actions';
import { RoadmapView } from '@/features/roadmap/components/RoadmapView';
import { currentUserId, getRoadmap } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/session';
import '@/features/roadmap/roadmap.css';

const btn = 'btn3d inline-flex items-center justify-center h-[52px] px-7 rounded-2xl font-bold text-[15px]';

/** Signed-out visitors: logo, one sentence, two buttons. */
function EntryScreen() {
  const t = getT('auth');
  return (
    <main className="min-h-dvh gutter py-10 grid content-center justify-items-center gap-6 text-center paper-grain">
      <Logo />
      <h1 className="font-display font-bold text-[22px] md:text-[28px] leading-snug text-ink max-w-[26ch]">
        {t('entry.lead')}
      </h1>
      <div className="grid w-full max-w-[320px] gap-3">
        <Link
          href={routes.login()}
          className={`${btn} [--face:var(--c-leaf)] [--edge:var(--c-leaf-2)] text-[var(--c-on-leaf)]`}
        >
          {t('entry.login')}
        </Link>
        <form action={enterDemo}>
          <button
            type="submit"
            className={`${btn} w-full border-[1.5px] border-line-2 [--face:var(--c-paper)] [--edge:var(--c-line-2)] text-ink`}
          >
            {t('entry.demo')}
          </button>
        </form>
      </div>
    </main>
  );
}

// Home: the map («Монголын аялал») for students. ?demo=states shows every pin state (design review).
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession().catch(() => null);
  if (!session) return <EntryScreen />;
  const sp = await searchParams;
  const userId = await currentUserId();
  const [shell, server] = await Promise.all([
    loadShell(),
    userId ? getRoadmap(userId).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <AppShell {...shell} variant="map">
      <h1 className="sr-only">{getT('roadmap')('pages.roadmap.title')}</h1>
      <RoadmapView demo={!userId} server={server} sample={sp.demo === 'states'} />
    </AppShell>
  );
}
