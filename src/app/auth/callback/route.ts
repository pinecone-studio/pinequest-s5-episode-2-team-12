// Google OAuth and the email magic link land here: exchange the code for a session cookie, then go home.
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { DEMO_COOKIE, safeNext } from '@/lib/auth-gate';
import { getDb } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const db = await getDb();
  if (db) {
    const { error } = code
      ? await db.auth.exchangeCodeForSession(code)
      : tokenHash && type
        ? await db.auth.verifyOtp({ token_hash: tokenHash, type })
        : { error: new Error('missing code') };
    if (!error) {
      const res = NextResponse.redirect(new URL(next, url.origin));
      res.cookies.delete(DEMO_COOKIE);
      return res;
    }
  }
  return NextResponse.redirect(new URL('/login?error=1', url.origin));
}
