export interface LevelInfo {
  level: number;
  title: string;
  minXp: number;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, title: 'Explorer', minXp: 0 },
  { level: 2, title: 'Thinker', minXp: 200 },
  { level: 3, title: 'Problem Solver', minXp: 500 },
  { level: 4, title: 'Graph Navigator', minXp: 900 },
  { level: 5, title: 'Desmos Strategist', minXp: 1400 },
  { level: 6, title: 'Math Master', minXp: 2000 },
];

export function getLevelByXp(xp: number): LevelInfo {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXp) {
      current = l;
    } else {
      break;
    }
  }
  return current;
}
