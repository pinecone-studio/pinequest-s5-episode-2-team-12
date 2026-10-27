// Service-role Supabase client for trusted writes (XP, badges, roadmap progress) from Server Actions.
// It bypasses RLS. Feature writes require an authenticated user and validated input.
// Password login may resolve a validated username here; it never returns the email to the client
// and still verifies the password with Supabase Auth.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { serverEnv } from './env';

let admin: SupabaseClient | null = null;

/** null when the service-role key or the project URL is missing. */
export function getAdminDb(): SupabaseClient | null {
  const { supabaseUrl } = publicEnv();
  const key = serverEnv().supabaseServiceRole;
  if (!supabaseUrl || !key) return null;
  if (!admin) {
    admin = createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return admin;
}

/**
 * Client for reading the question bank (migration 0009 hides it from students). Service role when set,
 * otherwise the request's client (admins can still read); null without Supabase. Callers filter `reviewed`.
 */
export async function getQuestionsDb(): Promise<SupabaseClient | null> {
  const admin = getAdminDb();
  if (admin) return admin;
  const { getDb } = await import('@/lib/supabase/server');
  return getDb();
}

/** Legacy projects keep their original questions table; the compatible app bank is separate. */
export function getQuestionsTable(): string {
  return serverEnv().supabaseQuestionsTable;
}
