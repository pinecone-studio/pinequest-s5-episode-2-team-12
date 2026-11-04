'use server';
// Teacher classes · writes. The database functions (migration 0022) check the caller; these only validate input.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { routes } from '@/lib/routes';
import { getDb } from '@/lib/supabase/server';
import { normalizeCode } from './lib/report';
import { classFailure } from './queries';

type Ok<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

async function db() {
  const d = await getDb();
  if (!d) return null;
  const { data } = await d.auth.getUser();
  return data.user && !data.user.is_anonymous ? d : null;
}

/** Postgres raise messages the page knows how to show; everything else is a generic error. */
const KNOWN = new Set(['not_found', 'own_class', 'class_full', 'too_many_classes', 'bad_name', 'forbidden']);
const reasonOf = (e: { code?: string; message?: string }) =>
  e.message && KNOWN.has(e.message) ? e.message : classFailure(e);

export async function createClass(name: string): Promise<Ok<{ id: string; code: string }>> {
  const n = z.string().trim().min(1).max(60).safeParse(name);
  if (!n.success) return { ok: false, reason: 'bad_name' };
  const d = await db();
  if (!d) return { ok: false, reason: 'demo_mode' };
  const { data, error } = await d.rpc('create_class', { p_name: n.data });
  if (error) return { ok: false, reason: reasonOf(error) };
  const row = (data as { id: string; join_code: string }[])[0];
  if (!row) return { ok: false, reason: 'database_error' };
  revalidatePath(routes.classes);
  return { ok: true, id: row.id, code: row.join_code };
}

export async function joinClass(code: string): Promise<Ok<{ id: string; name: string }>> {
  const c = normalizeCode(code);
  if (!c) return { ok: false, reason: 'bad_code' };
  const d = await db();
  if (!d) return { ok: false, reason: 'demo_mode' };
  const { data, error } = await d.rpc('join_class', { p_code: c });
  if (error) return { ok: false, reason: reasonOf(error) };
  const row = (data as { id: string; name: string }[])[0];
  if (!row) return { ok: false, reason: 'not_found' };
  revalidatePath(routes.classes);
  return { ok: true, id: row.id, name: row.name };
}

export async function leaveClass(id: string): Promise<Ok> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, reason: 'invalid_input' };
  const d = await db();
  if (!d) return { ok: false, reason: 'demo_mode' };
  const { error } = await d.rpc('leave_class', { p_class: id });
  if (error) return { ok: false, reason: reasonOf(error) };
  revalidatePath(routes.classes);
  return { ok: true };
}

export async function removeMember(classId: string, userId: string): Promise<Ok> {
  const ids = z.tuple([z.string().uuid(), z.string().uuid()]).safeParse([classId, userId]);
  if (!ids.success) return { ok: false, reason: 'invalid_input' };
  const d = await db();
  if (!d) return { ok: false, reason: 'demo_mode' };
  const { error } = await d.rpc('remove_class_member', { p_class: classId, p_user: userId });
  if (error) return { ok: false, reason: reasonOf(error) };
  revalidatePath(routes.classReport(classId));
  return { ok: true };
}
