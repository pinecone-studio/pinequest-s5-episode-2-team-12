// Section I · profile.
import { getDb } from '@/lib/supabase/server';
import { TZ } from '@/lib/time';
import type { Profile } from '@/types';

export const DEMO_PROFILE: Profile = {
  id: 'u-demo',
  name: 'Demo',
  onboarded: true,
  target: 700,
  examDate: '2026-12-05',
  start: 'english',
  tz: TZ,
  hidePublic: false,
  friendsOnly: false,
};

export type ProfileRow = {
  id: string;
  name: string | null;
  onboarded: boolean | null;
  confidence: number | null;
  sat_exp: Profile['satExp'] | null;
  desmos: Profile['desmos'] | null;
  target: number | null;
  exam_date: string | null;
  start: Profile['start'] | null;
  tz: string | null;
  hide_public: boolean | null;
  friends_only: boolean | null;
};

/** profiles row (snake_case, nullable) → Profile with the demo defaults filled in. */
export function profileFromRow(r: ProfileRow): Profile {
  return {
    id: r.id,
    name: r.name ?? '',
    onboarded: r.onboarded ?? false,
    confidence: r.confidence ?? undefined,
    satExp: r.sat_exp ?? undefined,
    desmos: r.desmos ?? undefined,
    target: r.target ?? DEMO_PROFILE.target,
    examDate: r.exam_date ?? DEMO_PROFILE.examDate,
    start: r.start ?? undefined,
    tz: r.tz ?? TZ,
    hidePublic: r.hide_public ?? false,
    friendsOnly: r.friends_only ?? false,
  };
}

export async function getProfile(): Promise<Profile> {
  const db = await getDb();
  if (!db) return DEMO_PROFILE;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ...DEMO_PROFILE, id: 'anon', name: '', onboarded: false };
  const { data, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return data
    ? profileFromRow(data as ProfileRow)
    : { ...DEMO_PROFILE, id: user.id, name: '', onboarded: false };
}
