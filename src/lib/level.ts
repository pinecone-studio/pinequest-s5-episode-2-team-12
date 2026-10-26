export interface LevelInfo {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

export function calculateLevel(totalXp: number): LevelInfo {
  // Түвшин бүрийн шаардагдах XP
  // L1: 0, L2: 100, L3: 250, L4: 450, L5: 700, L6: 1000...
  let level = 1;
  let xpForNext = 100;
  let currentLevelBaseXp = 0;

  while (totalXp >= currentLevelBaseXp + xpForNext) {
    currentLevelBaseXp += xpForNext;
    level++;
    xpForNext = Math.round(xpForNext * 1.5); // Түвшин ахих бүрд шаардагдах XP нэмэгдэнэ
  }

  const xpInCurrentLevel = totalXp - currentLevelBaseXp;
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpForNext) * 100));

  return {
    level,
    currentXp: totalXp,
    nextLevelXp: currentLevelBaseXp + xpForNext,
    progressPercent,
  };
}
