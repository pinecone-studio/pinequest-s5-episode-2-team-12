// Demo auth service. Supabase is configured for the project, but login runs in demo mode for now:
// every call waits a moment and succeeds, except the two triggers below that show the error states.
// To go live, write a Supabase AuthService (getBrowserDb().auth.signInWithPassword, signUp,
// signInWithOAuth, resetPasswordForEmail) and pass it to <AuthCard service={…} />.
import type { ErrorCode } from './validation';

export type SocialProvider = 'google' | 'github' | 'apple';

export type AuthUser = {
  name: string;
  email: string;
  provider: 'password' | SocialProvider;
};

export class AuthError extends Error {
  readonly code: ErrorCode;
  readonly field: 'email' | 'password' | 'form';

  constructor(code: ErrorCode, field: 'email' | 'password' | 'form' = 'form') {
    super(code);
    this.name = 'AuthError';
    this.code = code;
    this.field = field;
  }
}

export type AuthService = {
  signIn(input: { email: string; password: string }): Promise<AuthUser>;
  signUp(input: { name: string; email: string; password: string }): Promise<AuthUser>;
  signInWithProvider(provider: SocialProvider): Promise<AuthUser>;
  requestPasswordReset(email: string): Promise<void>;
};

/** Inputs that deliberately fail in demo mode. */
export const DEMO_TRIGGERS = {
  wrongPassword: 'wrongpass',
  takenEmail: 'taken@suprep.mn',
} as const;

/** "bat.erdene@school.mn" → "Bat Erdene" */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return name || email;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createDemoAuth({ latencyMs = 1500 }: { latencyMs?: number } = {}): AuthService {
  return {
    async signIn({ email, password }) {
      await wait(latencyMs);
      if (password === DEMO_TRIGGERS.wrongPassword) throw new AuthError('wrongPassword', 'password');
      return { name: nameFromEmail(email.trim()), email: email.trim(), provider: 'password' };
    },
    async signUp({ name, email }) {
      await wait(latencyMs);
      if (email.trim().toLowerCase() === DEMO_TRIGGERS.takenEmail) throw new AuthError('emailTaken', 'email');
      return { name: name.trim(), email: email.trim(), provider: 'password' };
    },
    async signInWithProvider(provider) {
      await wait(latencyMs);
      return { name: 'Demo Student', email: `demo@${provider}.suprep.mn`, provider };
    },
    async requestPasswordReset() {
      await wait(latencyMs);
    },
  };
}

export const demoAuth = createDemoAuth();
