'use server';
// Admin panel writes. Input is validated here; the admin_* RPCs (migrations 0017, 0018) check the role again in
// the database, so a forged call from a student's browser still fails.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { difficultyName, OFFICIAL_DOMAINS, OFFICIAL_SKILLS } from '@/features/practice/lib/official';
import { getDb } from '@/lib/supabase/server';
import { type AdminFailure, adminFailure } from './queries';

export type AdminResult =
  | { ok: true }
  | { ok: false; reason: AdminFailure | 'invalid_input' | 'self_demote' | 'not_found' };

const Id = z.string().uuid();

async function call(fn: string, args: Record<string, unknown>, path: string): Promise<AdminResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  const { error } = await db.rpc(fn, args);
  if (error) {
    if (error.message === 'self_demote') return { ok: false, reason: 'self_demote' };
    if (error.message === 'not_found') return { ok: false, reason: 'not_found' };
    if (/^invalid_/.test(error.message)) return { ok: false, reason: 'invalid_input' };
    return { ok: false, reason: adminFailure(error) };
  }
  revalidatePath(path);
  revalidatePath('/admin');
  return { ok: true };
}

export async function setUserRole(userId: string, role: 'student' | 'admin'): Promise<AdminResult> {
  if (!Id.safeParse(userId).success || (role !== 'student' && role !== 'admin'))
    return { ok: false, reason: 'invalid_input' };
  return call('admin_set_role', { p_user: userId, p_role: role }, '/admin/users');
}

const Gems = z.object({
  userId: Id,
  amount: z
    .number()
    .int()
    .min(-1000)
    .max(1000)
    .refine((n) => n !== 0),
  note: z.string().trim().max(30).default(''),
});

export async function grantGems(input: unknown): Promise<AdminResult> {
  const parsed = Gems.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { userId, amount, note } = parsed.data;
  return call('admin_grant_gems', { p_user: userId, p_amount: amount, p_note: note }, '/admin/users');
}

export async function resolveReport(id: string, resolved: boolean): Promise<AdminResult> {
  if (!Id.safeParse(id).success) return { ok: false, reason: 'invalid_input' };
  return call('admin_resolve_report', { p_id: id, p_resolved: resolved === true }, '/admin/reports');
}

const Review = z.object({
  id: Id,
  status: z.enum(['new', 'approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

export async function reviewFeedback(input: unknown): Promise<AdminResult> {
  const parsed = Review.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { id, status, note } = parsed.data;
  return call(
    'admin_review_feedback',
    { p_id: id, p_status: status, p_note: note ?? null },
    '/admin/feedback',
  );
}

// ———— content (migration 0018) ————

const SatQuestion = z
  .object({
    domain: z.enum(['alg', 'adv', 'psda', 'geo']),
    skill: z.string().trim().min(1).max(120),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    prompt: z.string().trim().min(1).max(2000),
    format: z.enum(['mcq', 'spr']),
    choices: z.array(z.string().trim().min(1).max(300)).length(4).optional(),
    answer: z.string().trim().min(1).max(200),
    explanation: z.string().trim().max(3000).default(''),
  })
  .refine((q) => (q.format === 'mcq' ? q.choices && /^[A-D]$/.test(q.answer) : !q.choices))
  .refine((q) => OFFICIAL_SKILLS[q.domain].includes(q.skill));

/** A new item in the official bank (/bank). Grid-in answers: every accepted value separated by "|". */
export async function addSatQuestion(input: unknown): Promise<AdminResult> {
  const parsed = SatQuestion.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const q = parsed.data;
  return call(
    'admin_add_sat_question',
    {
      p_domain: OFFICIAL_DOMAINS[q.domain],
      p_skill: q.skill,
      p_difficulty: difficultyName(q.difficulty),
      p_prompt: q.prompt,
      p_choices: q.format === 'mcq' ? q.choices : null,
      p_answer: q.answer,
      p_explanation: q.explanation,
    },
    '/admin/content',
  );
}

export async function deleteSatQuestion(id: string): Promise<AdminResult> {
  if (typeof id !== 'string' || !/^adm[0-9a-f]{9}$/.test(id)) return { ok: false, reason: 'invalid_input' };
  return call('admin_delete_sat_question', { p_id: id }, '/admin/content');
}

const WordCard = z.object({
  front: z.string().trim().min(1).max(80),
  back: z.string().trim().min(1).max(120),
  ex: z.string().trim().max(300).default(''),
  hook: z.string().trim().max(300).default(''),
});

/** A new «Үгс» card for every student's /flashcards. */
export async function addWordCard(input: unknown): Promise<AdminResult> {
  const parsed = WordCard.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { front, back, ex, hook } = parsed.data;
  const r = await call(
    'admin_add_card',
    { p_front: front, p_back: back, p_ex: ex, p_hook: hook },
    '/admin/content',
  );
  if (r.ok) revalidatePath('/flashcards');
  return r;
}

export async function deleteWordCard(id: string): Promise<AdminResult> {
  if (!Id.safeParse(id).success) return { ok: false, reason: 'invalid_input' };
  const r = await call('admin_delete_card', { p_id: id }, '/admin/content');
  if (r.ok) revalidatePath('/flashcards');
  return r;
}
