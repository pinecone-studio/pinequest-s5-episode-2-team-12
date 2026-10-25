// Who may open which path. Pure, so proxy.ts stays thin and the rules are unit-tested.

/** Set by «Демо сурагчаар орох» when Supabase is not configured or anonymous sign-in is off. */
export const DEMO_COOKIE = 'suprep-demo';

/** Paths a signed-out visitor may open. `/` shows the entry screen to them and the map to everyone else. */
const PUBLIC = ['/', '/login', '/auth', '/api'];

export function isPublicPath(path: string): boolean {
  return PUBLIC.some((p) => path === p || (p !== '/' && path.startsWith(`${p}/`)));
}

export type GateResult = { action: 'next' } | { action: 'redirect'; to: string };

/** Signed-out → entry screen; signed-in → no login page. */
export function gate(path: string, signedIn: boolean): GateResult {
  if (!signedIn && !isPublicPath(path)) return { action: 'redirect', to: '/' };
  if (signedIn && path === '/login') return { action: 'redirect', to: '/' };
  return { action: 'next' };
}

/** Only same-site relative paths survive as a post-login target. */
export function safeNext(next: string | null | undefined): string {
  return next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}
