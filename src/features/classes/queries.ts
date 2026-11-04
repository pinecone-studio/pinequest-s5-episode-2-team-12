// Teacher classes · reads (migration 0022). Every function checks who is asking inside the database.
import { getDb } from '@/lib/supabase/server';
import { demoRows, type StudentRow } from './lib/report';

export type ClassItem = {
  id: string;
  name: string;
  join_code: string | null;
  teacher: boolean;
  members: number;
};
export type ClassFailure = 'demo_mode' | 'not_installed' | 'forbidden' | 'database_error';
export type ClassRead<T> = { ok: true; data: T } | { ok: false; reason: ClassFailure };

export function classFailure(error: { code?: string; message?: string }): ClassFailure {
  // PGRST202: the function isn't in the schema cache — migration 0022 hasn't been run yet
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42883')
    return 'not_installed';
  if (error.code === '42501' || error.message === 'forbidden') return 'forbidden';
  return 'database_error';
}

async function signedInDb() {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user && !data.user.is_anonymous ? db : null;
}

export const DEMO_CLASS: ClassItem = {
  id: 'demo',
  name: '12б анги (жишээ)',
  join_code: 'SUU7QK',
  teacher: true,
  members: 4,
};

export async function myClasses(): Promise<ClassRead<ClassItem[]>> {
  const db = await signedInDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  const { data, error } = await db.rpc('my_classes');
  if (error) return { ok: false, reason: classFailure(error) };
  return { ok: true, data: ((data ?? []) as ClassItem[]).map((c) => ({ ...c, members: Number(c.members) })) };
}

export async function classReport(id: string): Promise<ClassRead<{ cls: ClassItem; rows: StudentRow[] }>> {
  if (id === DEMO_CLASS.id) return { ok: true, data: { cls: DEMO_CLASS, rows: demoRows(Date.now()) } };
  const db = await signedInDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  const mine = await myClasses();
  if (!mine.ok) return mine;
  const cls = mine.data.find((c) => c.id === id && c.teacher);
  if (!cls) return { ok: false, reason: 'forbidden' };
  const { data, error } = await db.rpc('class_report', { p_class: id });
  if (error) return { ok: false, reason: classFailure(error) };
  const rows = ((data ?? []) as StudentRow[]).map((r) => ({
    ...r,
    answers: Number(r.answers),
    correct: Number(r.correct),
    week: Number(r.week),
    open_mistakes: Number(r.open_mistakes),
    weak_topics: (r.weak_topics ?? []).map(Number),
  }));
  return { ok: true, data: { cls, rows } };
}
