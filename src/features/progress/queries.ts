// Section F · stats, badges, league.
import { getDb } from '@/lib/supabase/server';
import { BADGES } from '@/mocks/meta';
import type { Badge, LeagueRow, Stats } from '@/types';
import { statsFromXp, type XpRow } from './lib/stats';

// Demo mode shows a fresh student: no invented XP, streak or rivals.
const DEMO_STATS: Stats = { xp: 0, level: 1, streak: 0, days: [], mastery: {} };

/** XP, level, streak and study days, all derived from xp_events. */
export async function getStats(userId: string): Promise<Stats> {
  const db = await getDb();
  if (!db) return DEMO_STATS;
  const { data, error } = await db.from('xp_events').select('amount, at').eq('user_id', userId);
  if (error) throw error;
  return statsFromXp((data ?? []) as XpRow[]);
}

/** All badges with `earned` flags. */
export async function listBadges(userId: string): Promise<(Badge & { earned: boolean })[]> {
  const db = await getDb();
  if (!db) return BADGES.map((b, i) => ({ ...b, earned: i < 2 }));
  const { data, error } = await db.from('user_badges').select('badge_id').eq('user_id', userId);
  if (error) throw error;
  const got = new Set((data ?? []).map((r) => r.badge_id as string));
  return BADGES.map((b) => ({ ...b, earned: got.has(b.id) }));
}

export async function getLeague(weekId: string): Promise<LeagueRow[]> {
  const db = await getDb();
  if (!db) return [];
  const { data, error } = await db
    .from('league_rows')
    .select('user_id, name, xp')
    .eq('week_id', weekId)
    .order('xp', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ userId: r.user_id, name: r.name, xp: r.xp }));
}
