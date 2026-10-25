export type XpReason =
  | 'lesson'
  | 'checkpoint'
  | 'desmos'
  | 'practice'
  | 'exam'
  | 'mistake-review'
  | 'cards'
  | 'quest'
  | 'streak'
  | 'onboarding'
  | 'placement'
  | 'roadmap';

/** One row in xp_events. `key` makes awarding idempotent (same key = counted once). */
export type XpEvent = {
  id: string;
  userId: string;
  amount: number;
  reason: XpReason;
  /** e.g. "lesson:s1-l3" */
  key: string;
  /** ISO timestamp. */
  at: string;
};

export type Level = { n: number; xp: number; en: string; mn: string };

export type BadgeGlyph =
  | 'eq'
  | 'book'
  | 'lens'
  | 'cross'
  | 'cursor'
  | 'crown'
  | 'compass'
  | 'flame'
  | 'mend'
  | 'clock'
  | 'map'
  | 'flag';
export type Badge = { id: string; en: string; mn: string; how: string; glyph: BadgeGlyph };

export type Quest = { id: string; title: string; target: number; xp: number; href: string };

export type Stats = {
  xp: number;
  level: number;
  streak: number;
  /** Day keys (YYYY-MM-DD, Asia/Ulaanbaatar) the student studied. */
  days: string[];
  /** Skill → 0..100 */
  mastery: Record<string, number>;
};

export type LeagueRow = { userId: string; name: string; xp: number; me?: boolean };
