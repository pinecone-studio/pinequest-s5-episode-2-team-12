export interface QuestDefinition {
  id: string;
  title: string;
  target: number;
  rewardXp: number;
}

export const DAILY_QUESTS: QuestDefinition[] = [
  { id: 'vocab_5', title: '5 үг цээжлэх', target: 5, rewardXp: 10 },
  { id: 'desmos_1', title: '1 Desmos график байгуулах', target: 1, rewardXp: 10 },
  { id: 'fix_3_errors', title: '3 алдаа засах', target: 3, rewardXp: 10 },
  { id: 'exercises_5', title: '5 дасгал бодох', target: 5, rewardXp: 10 },
];

export async function bumpQuest(userId: string, questId: string, n: number = 1) {
  'use server';

  const { getDb } = await import('@/lib/supabase/server');
  const { awardXp } = await import('./actions');
  const { getUlaanbaatarDate } = await import('@/lib/streak');

  const supabase = await getDb();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const today = getUlaanbaatarDate();

  // Өнөөдрийн quest progress байгаа эсэхийг шалгах
  const { data: progress } = await supabase
    .from('quest_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .eq('date', today)
    .single();

  const questDef = DAILY_QUESTS.find((q) => q.id === questId);
  if (!questDef) return { success: false, error: 'Quest not found' };

  const currentCount = progress?.progress || 0;
  const isAlreadyCompleted = progress?.completed || false;

  if (isAlreadyCompleted) {
    return { success: true, completed: true, alreadyClaimed: true };
  }

  const newCount = Math.min(questDef.target, currentCount + n);
  const newlyCompleted = newCount >= questDef.target;

  if (progress) {
    await supabase
      .from('quest_progress')
      .update({
        progress: newCount,
        completed: newlyCompleted,
      })
      .eq('id', progress.id);
  } else {
    await supabase.from('quest_progress').insert({
      user_id: userId,
      quest_id: questId,
      date: today,
      progress: newCount,
      completed: newlyCompleted,
    });
  }

  // Сая биелсэн бол +10 XP өгөх (Нэг удаа)
  if (newlyCompleted && !isAlreadyCompleted) {
    await awardXp(
      userId,
      questDef.rewardXp,
      `Өдөр тутмын даалгавар: ${questDef.title}`,
      `quest_${questId}_${today}`,
    );
  }

  return {
    success: true,
    progress: newCount,
    completed: newlyCompleted,
  };
}
