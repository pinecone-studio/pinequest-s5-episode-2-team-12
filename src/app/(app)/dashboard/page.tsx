import { listDecks } from '@/features/cards/queries';
import { listDesmosLessons } from '@/features/desmos/queries';
import { Dashboard } from '@/features/home/components/Dashboard';
import { getProfile } from '@/features/home/queries';
import { getProgress, listStages } from '@/features/journey/queries';
import { listQuestions } from '@/features/practice/queries';
import { getLeague, getStats } from '@/features/progress/queries';
import { currentUserId, getRoadmap } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';
import { getUlaanbaatarDate } from '@/lib/streak';

export const metadata = { title: 'Нүүр' };

/** ISO week id (2026-W43) for the league table. */
function weekId(day = getUlaanbaatarDate()): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round((d.getTime() - jan4.getTime()) / 86400000 / 7);
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}

// Section I · I3
export default async function DashboardPage() {
  const t = getT('home');
  const [profile, userId] = await Promise.all([getProfile(), currentUserId()]);
  const [stats, stages, progress, league, decks, desmos, questions, roadmap] = await Promise.all([
    getStats(profile.id),
    listStages(),
    getProgress(profile.id),
    getLeague(weekId()),
    listDecks(profile.id).catch(() => []),
    listDesmosLessons().catch(() => []),
    listQuestions().catch(() => []),
    userId ? getRoadmap(userId).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <Dashboard
      t={t}
      data={{
        name: profile.name || t('pages.dashboard.title'),
        target: profile.target ?? 700,
        examDate: profile.examDate ?? '2026-12-05',
        stats,
        stages,
        done: new Set(progress.filter((p) => p.done).map((p) => p.lessonId)),
        league,
        counts: {
          lessons: stages.reduce((n, s) => n + s.nodes.length, 0),
          desmos: desmos.length,
          decks: decks.length,
          questions: questions.length,
        },
        roadmap: { demo: !userId, server: roadmap },
      }}
    />
  );
}
