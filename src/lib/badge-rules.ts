export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const BADGES: BadgeDefinition[] = [
  { id: 'first_eq', name: 'Анхны тэгшитгэл', description: 'Анхны тэгшитгэлээ амжилттай бодсон', icon: '📐' },
  { id: 'vocab_explorer', name: 'Үгсийн судлаач', description: 'Эхний үгсээ цээжилсэн', icon: '📖' },
  {
    id: 'desmos_beginner',
    name: 'Desmos эхлэгч',
    description: 'Desmos дээр анхны график зурсан',
    icon: '📈',
  },
  {
    id: 'intersection_master',
    name: 'Огтлолцлын мастер',
    description: 'Графикийн огтлолцлыг амжилттай олов',
    icon: '✖️',
  },
  {
    id: 'graph_tracker',
    name: 'Графикийн мөрдөгч',
    description: 'Олон график амжилттай шинжсэн',
    icon: '🔍',
  },
  {
    id: 'desmos_master',
    name: 'Desmos мастер',
    description: 'Desmos сорилтуудыг төгс гүйцэтгэсэн',
    icon: '⚡',
  },
  {
    id: 'sat_strategist',
    name: 'SAT стратегич',
    description: 'SAT математикийн сорилтод амжилт гаргасан',
    icon: '🎯',
  },
  { id: 'streak_7', name: '7 хоногийн хэмнэл', description: '7 хоног тасралтгүй суралцсан', icon: '🔥' },
  { id: 'error_learner', name: 'Алдаанаасаа суралцагч', description: 'Алдаагаа засч суралцсан', icon: '💡' },
  { id: 'math_master', name: 'Математикийн мастер', description: 'Бүх түвшнийг амжилттай давав', icon: '👑' },
];

export function checkBadgeUnlocks(
  stats: {
    totalXp: number;
    streak: number;
    questsCompletedToday: number;
    masteryLevels: Record<string, number>;
  },
  unlockedBadgeIds: string[],
): string[] {
  const newlyUnlocked: string[] = [];

  if (stats.streak >= 7 && !unlockedBadgeIds.includes('streak_7')) {
    newlyUnlocked.push('streak_7');
  }
  if (stats.totalXp >= 500 && !unlockedBadgeIds.includes('math_master')) {
    newlyUnlocked.push('math_master');
  }

  return newlyUnlocked;
}
