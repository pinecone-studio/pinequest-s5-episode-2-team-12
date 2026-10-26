import { loadShell } from '@/components/shell/load-shell';
import { listMockAttempts } from '@/features/exam/mock-queries';
import { getProfile } from '@/features/home/queries';
import { type ProfileServer, ProfileView } from '@/features/profile/components/ProfileView';
import { listAnswers, questionMeta, weeklyRank } from '@/features/profile/queries';
import { listBadges } from '@/features/progress/queries';
import { getRoadmap } from '@/features/roadmap/queries';
import { getT } from '@/lib/i18n';
import { calculateLevel } from '@/lib/level';
import { getSession } from '@/lib/session';

export const metadata = { title: getT('profile')('title') };

// Section F · profile: header, ranking, skill radar, full-test history, badges.
export default async function ProfilePage() {
  const [shell, profile, session] = await Promise.all([
    loadShell(),
    getProfile(),
    getSession().catch(() => null),
  ]);
  const userId = session?.kind === 'user' ? session.userId : null;
  const [badges, server, rank] = await Promise.all([
    listBadges(profile.id).catch(() => []),
    userId
      ? Promise.all([
          listMockAttempts(userId).catch(() => []),
          listAnswers(userId).catch(() => []),
          getRoadmap(userId).catch(() => null),
        ]).then(
          ([mocks, answers, roadmap]): ProfileServer => ({
            mocks,
            answers,
            regionsDone: roadmap?.regionsDone ?? [],
          }),
        )
      : Promise.resolve(null),
    userId ? weeklyRank(userId) : Promise.resolve(null),
  ]);
  const xp = shell.user?.xp ?? 0;
  const lvl = calculateLevel(xp);
  return (
    <ProfileView
      demo={!userId}
      user={{
        name: profile.name,
        avatarId: profile.avatarId,
        aimag: profile.aimag,
        school: profile.school,
        level: lvl.level,
        levelPct: lvl.progressPercent,
        xp,
        streak: shell.user?.streak ?? 0,
      }}
      badges={badges}
      server={server}
      meta={questionMeta()}
      rank={rank}
      wallet={shell.wallet}
    />
  );
}
