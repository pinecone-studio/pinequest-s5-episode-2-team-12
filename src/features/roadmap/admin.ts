'use server';
// Section A · admin review of the roadmap bank. Only profiles.role = 'admin' may approve or edit.
import { revalidatePath } from 'next/cache';
import { routes } from '@/lib/routes';
import { getDb } from '@/lib/supabase/server';
import { getQuestionsTable } from '@/server/db';
import { AUTHORED, PLACEMENT } from './content/bank';
import { type RoadmapQuestion, RoadmapQuestionSchema } from './content/schema';

const BUNDLED = new Map<string, RoadmapQuestion>([...AUTHORED, ...PLACEMENT].map((q) => [q.id, q]));

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
  if (typeof id !== 'string' || !/^rm[a-z0-9-]+$/.test(id)) return { ok: false, reason: 'invalid_input' };
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };

  // The stored row wins; a question that was never imported starts from the bundled content/roadmap copy.
  const { data: row } = await db.from(getQuestionsTable()).select('content').eq('id', id).maybeSingle();
  const base = (row?.content as RoadmapQuestion | undefined) ?? BUNDLED.get(id);
  if (!base) return { ok: false, reason: 'invalid_input' };

  const allowed: (keyof ReviewPatch)[] = ['reviewed', 'prompt', 'mn', 'explain', 'hint', 'answer'];
  const clean = Object.fromEntries(
    Object.entries(patch ?? {}).filter(([k]) => allowed.includes(k as keyof ReviewPatch)),
  );
  const next = { ...base, ...clean };
  if (!RoadmapQuestionSchema.safeParse({ ...next, verify: undefined }).success)
    return { ok: false, reason: 'invalid_input' };

  // admin_save_question (migration 0018) checks the role again and upserts the whole question
  const { error } = await db.rpc('admin_save_question', { p_content: next, p_reviewed: next.reviewed });
  if (error) return { ok: false, reason: error.code === '42501' ? 'forbidden' : 'database_error' };
  revalidatePath(routes.adminQuestions);
  return { ok: true };
}
