// Admin panel reads. Each admin_* RPC (migration 0017) checks is_admin() inside the database, so they run on the
// signed-in admin's own session; a student calling them gets 'forbidden'. No service-role key is needed.
import { getDb } from '@/lib/supabase/server';

export type AdminDay = { day: string; signups: number; active: number };

export type AdminOverview = {
  users: number;
  guests: number;
  admins: number;
  onboarded: number;
  new_7d: number;
  active_1d: number;
  active_7d: number;
  answers_7d: number;
  mocks: number;
  ai_7d: number;
  xp_total: number;
  open_reports: number;
  new_feedback: number;
  pending_review: number;
  days: AdminDay[];
};

export type AdminUser = {
  id: string;
  email: string | null;
  username: string | null;
  name: string;
  role: 'student' | 'admin';
  onboarded: boolean;
  anonymous: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  xp: number;
  gems: number;
  reports: number;
};

export type AdminReport = {
  id: string;
  created_at: string;
  context: 'profile' | 'friend' | 'leaderboard' | 'duel' | 'group';
  reason: 'name' | 'avatar' | 'cheating' | 'harassment' | 'other';
  resolved: boolean;
  reporter: string;
  reporter_name: string;
  target: string;
  target_name: string;
  target_email: string | null;
  target_open: number;
};

export type FeedbackStatus = 'new' | 'approved' | 'rejected';

export type AdminFeedback = {
  id: string;
  created_at: string;
  user_name: string;
  mode: string;
  context_kind: string | null;
  prompt: string;
  reply: string;
  rating: 'up' | 'down';
  correction: string | null;
  model: string;
  status: FeedbackStatus;
  review_note: string | null;
};

export type AdminFailure = 'demo_mode' | 'not_installed' | 'forbidden' | 'database_error';
export type AdminRead<T> = { ok: true; data: T } | { ok: false; reason: AdminFailure };

/** PostgREST / Postgres error → why the panel can't show data. */
export function adminFailure(error: { code?: string; message?: string }): AdminFailure {
  // PGRST202: the function isn't in the schema cache — migration 0017 hasn't been run yet
  // PGRST205: a table it reads (custom_cards) isn't there either
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42883')
    return 'not_installed';
  if (error.code === '42501' || error.message === 'forbidden') return 'forbidden';
  return 'database_error';
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<AdminRead<T>> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  const { data, error } = await db.rpc(fn, args);
  if (error) return { ok: false, reason: adminFailure(error) };
  return { ok: true, data: data as T };
}

export const getOverview = () => rpc<AdminOverview>('admin_overview');

export const listUsers = (search = '') =>
  rpc<AdminUser[]>('admin_users', { p_search: search.slice(0, 80), p_limit: 200 });

export const listReports = (openOnly = true) =>
  rpc<AdminReport[]>('admin_reports', { p_open_only: openOnly });

export type AdminSatItem = {
  id: string;
  domain: string;
  skill: string;
  difficulty: string;
  question_type: string;
  question_text: string;
  created_at: string;
};

export type AdminWordCard = { id: string; front: string; back: string; created_at: string };

/** What admins added (both tables are readable by everyone; only the admin_* RPCs write them). */
export async function listAddedContent(): Promise<
  AdminRead<{ sat: AdminSatItem[]; cards: AdminWordCard[] }>
> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'demo_mode' };
  const [sat, cards] = await Promise.all([
    db
      .from('sat_math_questions')
      .select('id, domain, skill, difficulty, question_type, question_text, created_at')
      .eq('source', 'admin')
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('custom_cards')
      .select('id, front, back, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  const error = sat.error ?? cards.error;
  if (error) return { ok: false, reason: adminFailure(error) };
  return {
    ok: true,
    data: { sat: (sat.data ?? []) as AdminSatItem[], cards: (cards.data ?? []) as AdminWordCard[] },
  };
}

export const listFeedback = (status: FeedbackStatus | 'all' = 'new') =>
  rpc<AdminFeedback[]>('admin_feedback', { p_status: status });
