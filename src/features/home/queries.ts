// Section I · profile.
import { TUYA_PROFILE } from '@/features/demo/profile';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/supabase/server';
import { TZ } from '@/lib/time';
import type { Profile } from '@/types';

export const DEMO_PROFILE: Profile = TUYA_PROFILE;

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
  avatar_id?: string | null;
  aimag?: string | null;
  school?: string | null;
  age?: number | null;
  role?: Profile['role'] | null;
  last_math_score?: number | null;
  study_minutes?: Profile['studyMinutes'] | null;
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
    target: r.target ?? 700,
    examDate: r.exam_date ?? '',
    start: r.start ?? undefined,
    tz: r.tz ?? TZ,
    hidePublic: r.hide_public ?? false,
    friendsOnly: r.friends_only ?? false,
    avatarId: r.avatar_id ?? undefined,
    aimag: r.aimag ?? undefined,
    school: r.school ?? undefined,
    age: r.age ?? undefined,
    role: r.role ?? undefined,
    lastMathScore: r.last_math_score ?? null,
    studyMinutes: r.study_minutes ?? undefined,
  };
}

export async function getProfile(): Promise<Profile> {
  const db = await getDb();
  if (!db) return DEMO_PROFILE;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user && (await getSession())?.kind === 'demo') return DEMO_PROFILE;
  if (!user) return { ...DEMO_PROFILE, id: 'anon', name: '', onboarded: false };
  const { data, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return data
    ? profileFromRow(data as ProfileRow)
    : {
        id: user.id,
        name: '',
        onboarded: false,
        target: 700,
        examDate: '',
        tz: TZ,
        hidePublic: false,
        friendsOnly: false,
      };
}
