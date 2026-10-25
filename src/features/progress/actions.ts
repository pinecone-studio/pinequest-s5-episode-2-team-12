// Section F · F2 & F6 — level, streak, quests and badges for the progress pages.

import { calculateLevel } from '@/lib/level';
import { getUlaanbaatarDate } from '@/lib/streak';
import { getDb } from '@/lib/supabase/server';
import { BADGES } from '@/mocks/meta';
import { getStats } from './queries';
import { DAILY_QUESTS } from './quests';

export { awardXp } from '@/server/xp';

export async function getProgressData(userId: string) {
  const supabase = await getDb();
  const stats = await getStats(userId);
  const levelInfo = calculateLevel(stats.xp);

  if (!supabase) {
    return {
      levelInfo,
      streak: stats.streak,
      quests: DAILY_QUESTS.map((q) => ({ ...q, current: 0, completed: false })),
      badges: BADGES.map((b) => ({ ...b, name: b.mn, description: b.how, unlocked: false })),
    };
  }

  const today = getUlaanbaatarDate();
  const { data: questProgressList } = await supabase
    .from('quest_progress')
    .select('quest_id, progress, completed')
    .eq('user_id', userId)
    .eq('date', today);

  const quests = DAILY_QUESTS.map((q) => {
    const p = questProgressList?.find((item) => item.quest_id === q.id);
    return { ...q, current: p?.progress || 0, completed: p?.completed || false };
  });

  const { data: userBadges } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId);
  const unlockedBadgeIds = new Set(userBadges?.map((b) => b.badge_id as string) ?? []);
  const badges = BADGES.map((b) => ({
    ...b,
    name: b.mn,
    description: b.how,
    unlocked: unlockedBadgeIds.has(b.id),
  }));

  return { levelInfo, streak: stats.streak, quests, badges };
}
