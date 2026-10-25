// Leaderboard ranking: who is listed (privacy, blocks, flagged attempts) and their places. Pure
// (social.test.ts); the leaderboard RPC (migration 0012) applies the same rules in Postgres.
import { type Privacy, type Relation, visible } from './friends';

export type Scope = 'friends' | 'aimag' | 'national';
export type Metric = 'xp_week' | 'xp_all' | 'daily' | 'mock';

export type Candidate = {
  userId: string;
  name: string;
  avatarId?: string;
  level: number;
  aimag?: string;
  privacy: Privacy;
  /** The metric's value; null when the student has none (no daily today, no mock). */
  value: number | null;
  /** Tie-break: lower is better (daily total time). */
  timeMs?: number;
  /** The value comes from a flagged (impossible-timing) attempt. */
  flagged?: boolean;
};
export type Row = {
  rank: number;
  userId: string;
  name: string;
  avatarId?: string;
  level: number;
  value: number;
  me: boolean;
};

/**
 * Standard competition ranking (1, 2, 2, 4): ties share a place; equal values break on time when given.
 * `rel(id)` says how the viewer relates to each candidate.
 */
export function leaderboard(
  candidates: readonly Candidate[],
  viewer: { userId: string; aimag?: string },
  scope: Scope,
  rel: (userId: string) => Relation,
): Row[] {
  const listed = candidates.filter((c) => {
    const self = c.userId === viewer.userId;
    if (c.value === null || (c.flagged && !self)) return false;
    if (scope === 'aimag' && (!viewer.aimag || c.aimag !== viewer.aimag)) return false;
    return visible(scope, c.privacy, rel(c.userId), self);
  });
  listed.sort(
    (a, b) =>
      (b.value ?? 0) - (a.value ?? 0) || (a.timeMs ?? 0) - (b.timeMs ?? 0) || a.name.localeCompare(b.name),
  );
  const rows: Row[] = [];
  listed.forEach((c, i) => {
    const prev = listed[i - 1];
    const tied = prev && prev.value === c.value && (prev.timeMs ?? 0) === (c.timeMs ?? 0);
    rows.push({
      rank: tied ? rows[i - 1].rank : i + 1,
      userId: c.userId,
      name: c.name,
      avatarId: c.avatarId,
      level: c.level,
      value: c.value ?? 0,
      me: c.userId === viewer.userId,
    });
  });
  return rows;
}
