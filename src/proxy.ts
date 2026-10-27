// Runs before every page: refreshes the Supabase session cookie and sends signed-out visitors to the entry
// screen. Without Supabase the demo cookie is the only "session".
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { onboardingRedirect } from '@/features/onboarding/lib/routing';
import { DEMO_COOKIE, gate } from '@/lib/auth-gate';
import { hasSupabase, publicEnv } from '@/lib/env';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let signedIn = request.cookies.get(DEMO_COOKIE)?.value === '1';
  let accountSignedIn = false;

  if (hasSupabase()) {
    const { supabaseUrl, supabaseAnonKey } = publicEnv();
    const db = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    const {
      data: { user },
    } = await db.auth.getUser();
    signedIn ||= Boolean(user);
    accountSignedIn = Boolean(user && !user.is_anonymous);
    const path = request.nextUrl.pathname;
    if (user && !user.is_anonymous && !path.startsWith('/auth') && !path.startsWith('/api')) {
      const { data } = await db.from('profiles').select('onboarded').eq('id', user.id).maybeSingle();
      const destination = onboardingRedirect(path + request.nextUrl.search, Boolean(data?.onboarded));
      if (destination) {
        const to = NextResponse.redirect(new URL(destination, request.url));
        for (const c of response.cookies.getAll()) to.cookies.set(c);
        return to;
      }
    }
  }

  // Demo students can visit login to create a real account without discarding their demo.
  const result = gate(
    request.nextUrl.pathname,
    request.nextUrl.pathname === '/login' ? accountSignedIn : signedIn,
  );
  if (result.action === 'redirect') {
    const to = NextResponse.redirect(new URL(result.to, request.url));
    // keep refreshed auth cookies on the redirect
    for (const c of response.cookies.getAll()) to.cookies.set(c);
    return to;
  }
  return response;
}

export const config = {
  // pages only: skip Next internals, the API, and files with an extension (images, fonts, manifest…)
  matcher: ['/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)'],
};
