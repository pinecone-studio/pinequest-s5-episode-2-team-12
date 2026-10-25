'use server';
// Section A · admin review of the roadmap bank. Only profiles.role = 'admin' may approve or edit.
import { revalidatePath } from 'next/cache';
import { routes } from '@/lib/routes';
import { getDb } from '@/lib/supabase/server';
import { getAdminDb } from '@/server/db';
import { RoadmapQuestionSchema } from './content/schema';

export type ReviewPatch = {
  reviewed?: boolean;
  prompt?: string;
  mn?: string;
  explain?: string;
  hint?: string;
  answer?: number | string[];
};

type Result =
  | { ok: true }
  | { ok: false; reason: 'demo_mode' | 'forbidden' | 'invalid_input' | 'database_error' };

/** Signed-in admin's id, or a reason why not. */
export async function adminUserId(): Promise<{ id: string } | { reason: 'demo_mode' | 'forbidden' }> {
  const db = await getDb();
  if (!db) return { reason: 'demo_mode' };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { reason: 'forbidden' };
  const { data } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return data?.role === 'admin' ? { id: user.id } : { reason: 'forbidden' };
}

export async function reviewQuestion(id: string, patch: ReviewPatch): Promise<Result> {
  const who = await adminUserId();
  if ('reason' in who) return { ok: false, reason: who.reason };
  const admin = getAdminDb();
  if (!admin) return { ok: false, reason: 'database_error' };
  if (typeof id !== 'string' || !/^rm[a-z0-9-]+$/.test(id)) return { ok: false, reason: 'invalid_input' };

  const { data: row, error } = await admin.from('questions').select('content').eq('id', id).maybeSingle();
  if (error || !row) return { ok: false, reason: error ? 'database_error' : 'invalid_input' };

  const allowed: (keyof ReviewPatch)[] = ['reviewed', 'prompt', 'mn', 'explain', 'hint', 'answer'];
  const clean = Object.fromEntries(
    Object.entries(patch ?? {}).filter(([k]) => allowed.includes(k as keyof ReviewPatch)),
  );
  const next = { ...(row.content as object), ...clean };
  if (!RoadmapQuestionSchema.safeParse({ ...next, verify: undefined }).success)
    return { ok: false, reason: 'invalid_input' };

  const reviewed = (next as { reviewed: boolean }).reviewed;
  const { error: writeError } = await admin
    .from('questions')
    .update({ content: next, reviewed, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (writeError) return { ok: false, reason: 'database_error' };
  revalidatePath(routes.adminQuestions);
  return { ok: true };
}
