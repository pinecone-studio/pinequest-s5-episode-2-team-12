// Who is using the app, for Server Components and Server Actions.
import { DEMO_COOKIE } from './auth-gate';
import { getDb } from './supabase/server';

export type Session =
  /** Supabase account: email, Google, or the anonymous demo account. */
  | { kind: 'user'; userId: string; anonymous: boolean; email: string | null }
  /** Cookie-only demo (no Supabase, or anonymous sign-in disabled): data lives in localStorage / mocks. */
  | { kind: 'demo' };

export async function getSession(): Promise<Session | null> {
  const db = await getDb();
  if (db) {
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user)
      return {
        kind: 'user',
        userId: user.id,
        anonymous: user.is_anonymous ?? false,
        email: user.email ?? null,
      };
  }
  const { cookies } = await import('next/headers');
  return (await cookies()).get(DEMO_COOKIE)?.value === '1' ? { kind: 'demo' } : null;
}
