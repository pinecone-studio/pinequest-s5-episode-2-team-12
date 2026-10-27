import { safeNext } from '@/lib/auth-gate';

/** Keep provider callbacks and setup accessible while routing new members into setup. */
export function onboardingRedirect(path: string, onboarded: boolean): string | null {
  const pathname = path.split('?')[0];
  if (
    onboarded ||
    pathname === '/onboarding' ||
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname === '/api' ||
    pathname.startsWith('/api/')
  )
    return null;
  return `/onboarding?next=${encodeURIComponent(safeNext(path))}`;
}
