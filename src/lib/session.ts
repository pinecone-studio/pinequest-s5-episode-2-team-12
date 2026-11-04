// Who is using the app, for Server Components and Server Actions.
import { cache } from 'react';
import { DEMO_COOKIE } from './auth-gate';
import { getDb } from './supabase/server';

export type Session =
  /** Supabase account: email, Google, or the anonymous demo account. */
  | { kind: 'user'; userId: string; anonymous: boolean; email: string | null }
  /** Cookie-only demo (no Supabase, or anonymous sign-in disabled): data lives in localStorage / mocks. */
  | { kind: 'demo' };

/** The signed-in Supabase user, asked once per request: a page, its layout and its queries all need it, and
 *  every getUser() is a round trip to Supabase Auth. */
export const currentUser = cache(async () => {
  const db = await getDb();
  if (!db) return null;
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  return error ? null : user;
});

export const getSession = cache(async (): Promise<Session | null> => {
  const user = await currentUser();
  if (user)
    return {
      kind: 'user',
      userId: user.id,
      anonymous: user.is_anonymous ?? false,
      email: user.email ?? null,
    };
  const { cookies } = await import('next/headers');
  return (await cookies()).get(DEMO_COOKIE)?.value === '1' ? { kind: 'demo' } : null;
});
