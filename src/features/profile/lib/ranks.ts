import type { Row, Scope } from '@/features/social/lib/ranking';
export type ProfileRanks = Record<Scope, { rank: number; of: number } | null>;
export const EMPTY_RANKS: ProfileRanks = { national: null, aimag: null, friends: null };
export function rankSummary(rows: Row[]): ProfileRanks['national'] {
  const me = rows.find((row) => row.me);
  return me ? { rank: me.rank, of: rows.length } : null;
}

export type ProfileBoards = Record<Scope, Row[]>;
export const EMPTY_BOARDS: ProfileBoards = { national: [], aimag: [], friends: [] };
