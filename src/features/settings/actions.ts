'use server';
// Student settings (test date, time zone, privacy). Signed-in students write their own profiles row (RLS
// "own profile"); the demo returns { ok: false, reason: 'demo_mode' } and the client keeps it in localStorage.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AVATARS } from '@/components/brand/avatars';
import { AIMAGS } from '@/lib/aimags';
import { getDb } from '@/lib/supabase/server';

const Score = z.number().int().min(200).max(800).multipleOf(10);

const Patch = z
  .object({
    // '' clears it («Одоогоор өдрөө сонгоогүй»)
    examDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]),
    tz: z
      .string()
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }),
    hidePublic: z.boolean(),
    friendsOnly: z.boolean(),
    name: z.string().trim().min(1).max(40),
    avatarId: z.enum(AVATARS.map((a) => a.id) as [string, ...string[]]),
    aimag: z.enum(AIMAGS).nullable(),
    school: z.string().trim().max(60).nullable(),
    // the onboarding answers (features/onboarding/lib/schema.ts), editable later on /profile
    satExp: z.enum(['none', 'some', 'taken']),
    lastMathScore: Score.nullable(),
    target: Score,
    confidence: z.number().int().min(1).max(5),
    desmos: z.enum(['never', 'little', 'often']),
    studyMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
    start: z.enum(['foundations', 'english', 'desmos']),
    age: z.number().int().min(1).max(120).nullable(),
  })
  .partial()
  .strict()
  // as in onboarding: an official Math score only exists after taking the official SAT
  .refine((p) => p.satExp === undefined || p.satExp === 'taken' || !p.lastMathScore);

export type SettingsPatch = z.infer<typeof Patch>;
export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'demo_mode' | 'invalid_input' | 'database_error' };

export async function saveSettings(patch: SettingsPatch): Promise<SaveResult> {
  const parsed = Patch.safeParse(patch);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, reason: 'demo_mode' };
  const p = parsed.data;
  const row = {
    id: user.id,
    ...(p.examDate !== undefined && { exam_date: p.examDate || null }),
    ...(p.tz !== undefined && { tz: p.tz }),
    ...(p.hidePublic !== undefined && { hide_public: p.hidePublic }),
    ...(p.friendsOnly !== undefined && { friends_only: p.friendsOnly }),
    ...(p.name !== undefined && { name: p.name }),
    ...(p.avatarId !== undefined && { avatar_id: p.avatarId }),
    ...(p.aimag !== undefined && { aimag: p.aimag }),
    ...(p.school !== undefined && { school: p.school || null }),
    ...(p.satExp !== undefined && { sat_exp: p.satExp }),
    // leaving 'taken' drops the official score with it
    ...(p.satExp !== undefined && p.satExp !== 'taken' && { last_math_score: null }),
    ...(p.lastMathScore !== undefined &&
      (p.satExp ?? 'taken') === 'taken' && { last_math_score: p.lastMathScore }),
    ...(p.target !== undefined && { target: p.target }),
    ...(p.confidence !== undefined && { confidence: p.confidence }),
    ...(p.desmos !== undefined && { desmos: p.desmos }),
    ...(p.studyMinutes !== undefined && { study_minutes: p.studyMinutes }),
    ...(p.start !== undefined && { start: p.start }),
    ...(p.age !== undefined && { age: p.age }),
  };
  const { error } = await db.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) return { ok: false, reason: 'database_error' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
