'use server';
// Student settings (test date, time zone, privacy). Signed-in students write their own profiles row (RLS
// "own profile"); the demo returns { ok: false, reason: 'demo_mode' } and the client keeps it in localStorage.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AVATARS } from '@/components/brand/avatars';
import { AIMAGS } from '@/lib/aimags';
import { getDb } from '@/lib/supabase/server';

const Patch = z
  .object({
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  })
  .partial()
  .strict();

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
    ...(p.examDate !== undefined && { exam_date: p.examDate }),
    ...(p.tz !== undefined && { tz: p.tz }),
    ...(p.hidePublic !== undefined && { hide_public: p.hidePublic }),
    ...(p.friendsOnly !== undefined && { friends_only: p.friendsOnly }),
    ...(p.name !== undefined && { name: p.name }),
    ...(p.avatarId !== undefined && { avatar_id: p.avatarId }),
    ...(p.aimag !== undefined && { aimag: p.aimag }),
    ...(p.school !== undefined && { school: p.school || null }),
  };
  const { error } = await db.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) return { ok: false, reason: 'database_error' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
