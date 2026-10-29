// Server-side data for the app shell (top bar + drawer). Used by the (app) layout and the map home;
// cache() dedupes it when a page (settings) reads the same data in one request.
import { cache } from 'react';
import { getProfile } from '@/features/home/queries';
import { getStats } from '@/features/progress/queries';
import type { StudentSettings } from '@/features/settings/use-settings';
import { getWallet, type ServerWallet } from '@/features/shop/queries';
import { calculateLevel } from '@/lib/level';
import { getSession } from '@/lib/session';
import type { ShellUser } from './AppShell';

export type ShellData = {
  user?: ShellUser;
  settings: StudentSettings;
  demo: boolean;
  wallet: ServerWallet | null;
};

export const loadShell = cache(async (): Promise<ShellData> => {
  const [profile, session] = await Promise.all([getProfile(), getSession().catch(() => null)]);
  const settings: StudentSettings = {
    examDate: profile.examDate,
    tz: profile.tz,
    hidePublic: profile.hidePublic,
    friendsOnly: profile.friendsOnly,
  };
  const demo = session?.kind !== 'user';
  const wallet = session?.kind === 'user' ? await getWallet(session.userId).catch(() => null) : null;
  try {
    const stats = await getStats(profile.id);
    return {
      user: {
        name: profile.name,
        level: calculateLevel(stats.xp).level,
        xp: stats.xp,
        streak: stats.streak,
        avatarId: profile.avatarId,
        admin: profile.role === 'admin',
      },
      settings,
      demo,
      wallet,
    };
  } catch {
    // the shell still renders without stats (e.g. Supabase offline)
    return { settings, demo, wallet };
  }
});
