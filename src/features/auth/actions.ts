'use server';
// Sign-in: email one-time code, Google, and «Демо сурагчаар орох». No phone numbers.
// Demo entry uses a cookie and Tuya’s local sample scenario; it does not create a Supabase account.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { DEMO_COOKIE, safeNext } from '@/lib/auth-gate';
import { routes } from '@/lib/routes';
import { getDb } from '@/lib/supabase/server';
import { getAdminDb } from '@/server/db';
import { SignupCredentials } from './lib/credentials';
import { type AuthResult, authFailure } from './lib/errors';
import { loginPassword, registerPassword } from './lib/password-auth';
import { saveNewPassword, sendPasswordReset } from './lib/recovery';

export type { AuthResult } from './lib/errors';

const Email = z.string().trim().toLowerCase().email().max(254);
const Code = z
  .string()
  .trim()
  .regex(/^\d{6,8}$/);

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function setDemoCookie(on: boolean) {
  const store = await cookies();
  if (on) {
    store.set(DEMO_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
      secure: process.env.NODE_ENV === 'production',
    });
  } else store.delete(DEMO_COOKIE);
}

export async function enterDemo(): Promise<never> {
  const db = await getDb();
  if (db) {
    const { error } = await db.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  await setDemoCookie(true);
  redirect('/demo');
}

export async function previewOnboarding(): Promise<never> {
  await setDemoCookie(true);
  redirect('/onboarding');
}

export async function sendEmailCode(
  email: string,
  mode: 'login' | 'signup' = 'login',
  next?: string,
): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const parsed = Email.safeParse(email);
  if (!parsed.success) return { ok: false, reason: 'invalid_email' };
  try {
    const { error } = await db.auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: mode === 'signup',
        emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      },
    });
    return error ? authFailure(error, 'send') : { ok: true };
  } catch (error) {
    return authFailure(error, 'send');
  }
}

export async function verifyEmailCode(email: string, code: string, next?: string): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const e = Email.safeParse(email);
  const c = Code.safeParse(code);
  if (!e.success) return { ok: false, reason: 'invalid_email' };
  if (!c.success) return { ok: false, reason: 'invalid_code' };
  try {
    const { error } = await db.auth.verifyOtp({ email: e.data, token: c.data, type: 'email' });
    if (error) return authFailure(error, 'verify');
  } catch (error) {
    return authFailure(error, 'verify');
  }
  await setDemoCookie(false);
  redirect(safeNext(next));
}

export async function signInWithGoogle(next?: string): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const back = `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
  let destination: string;
  try {
    const { data, error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: back },
    });
    if (error) return authFailure(error, 'oauth');
    if (!data.url) return { ok: false, reason: 'provider_disabled' };
    destination = data.url;
  } catch (error) {
    return authFailure(error, 'oauth');
  }
  redirect(destination);
}

export async function signOut(): Promise<never> {
  const db = await getDb();
  if (db) await db.auth.signOut();
  await setDemoCookie(false);
  redirect('/');
}

export async function signUpWithPassword(input: unknown, next?: string): Promise<AuthResult> {
  const parsed = SignupCredentials.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      reason: path === 'email' ? 'invalid_email' : path === 'username' ? 'invalid_username' : 'weak_password',
    };
  }
  const db = await getDb();
  const admin = getAdminDb();
  if (!db || !admin) return { ok: false, reason: 'not_configured' };
  const result = await registerPassword(db, admin, parsed.data);
  if (!result.ok) return result;
  await setDemoCookie(false);
  redirect(safeNext(next));
}

export async function signInWithPassword(
  identifier: string,
  password: string,
  next?: string,
): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const result = await loginPassword(db, getAdminDb(), identifier, password);
  if (!result.ok) return result;
  await setDemoCookie(false);
  redirect(safeNext(next));
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  return sendPasswordReset(
    db,
    email,
    `${await origin()}/auth/callback?next=${encodeURIComponent(routes.updatePassword)}`,
  );
}
export async function updatePassword(input: unknown): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const result = await saveNewPassword(db, input);
  if (!result.ok) return result;
  // End this session after updating; sign in again with the new password.
  try {
    await db.auth.signOut({ scope: 'global' });
  } catch {
    // The password has already changed; report success if sign-out loses its connection.
    return { ok: true };
  }
  await setDemoCookie(false);
  redirect('/login?password=updated');
}
