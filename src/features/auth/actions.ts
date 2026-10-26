'use server';
// Sign-in: email one-time code, Google, and «Демо сурагчаар орох». No phone numbers.
// The demo is a Supabase anonymous account when Supabase allows it (it can be upgraded later); otherwise a
// cookie, and every feature falls back to localStorage / src/mocks as before.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { DEMO_COOKIE, safeNext } from '@/lib/auth-gate';
import { getDb } from '@/lib/supabase/server';

export type AuthResult = { ok: true } | { ok: false; reason: 'not_configured' | 'invalid_input' | 'failed' };

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
  const anon = db ? await db.auth.signInAnonymously() : null;
  // anonymous sign-in disabled in the Supabase project → cookie demo
  if (!anon || anon.error) await setDemoCookie(true);
  redirect('/');
}

export async function sendEmailCode(email: string): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const parsed = Email.safeParse(email);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true, emailRedirectTo: `${await origin()}/auth/callback` },
  });
  return error ? { ok: false, reason: 'failed' } : { ok: true };
}

export async function verifyEmailCode(email: string, code: string, next?: string): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const e = Email.safeParse(email);
  const c = Code.safeParse(code);
  if (!e.success || !c.success) return { ok: false, reason: 'invalid_input' };
  const { error } = await db.auth.verifyOtp({ email: e.data, token: c.data, type: 'email' });
  if (error) return { ok: false, reason: 'failed' };
  await setDemoCookie(false);
  redirect(safeNext(next));
}

export async function signInWithGoogle(next?: string): Promise<AuthResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: 'not_configured' };
  const back = `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: back },
  });
  if (error || !data.url) return { ok: false, reason: 'failed' };
  redirect(data.url);
}

export async function signOut(): Promise<never> {
  const db = await getDb();
  if (db) await db.auth.signOut();
  await setDemoCookie(false);
  redirect('/');
}
