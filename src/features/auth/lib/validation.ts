// Auth form rules. Validators return message keys (auth.errors.*), never display text,
// so the screen can translate them with useT('auth').

export type AuthView = 'signin' | 'signup' | 'reset';

export type AuthValues = {
  name: string;
  email: string;
  password: string;
  remember: boolean;
  terms: boolean;
};

export type AuthField = keyof AuthValues;

export type ErrorCode =
  | 'nameRequired'
  | 'nameShort'
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordShort'
  | 'passwordWeak'
  | 'termsRequired'
  | 'wrongPassword'
  | 'emailTaken'
  | 'generic';

export type AuthErrors = Partial<Record<AuthField, ErrorCode>>;

/** Fields each view renders, in focus order. */
export const VIEW_FIELDS: Record<AuthView, AuthField[]> = {
  signin: ['email', 'password'],
  signup: ['name', 'email', 'password', 'terms'],
  reset: ['email'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateName(value: string): ErrorCode | undefined {
  const v = value.trim();
  if (!v) return 'nameRequired';
  if (v.length < 2) return 'nameShort';
  return undefined;
}

export function validateEmail(value: string): ErrorCode | undefined {
  const v = value.trim();
  if (!v) return 'emailRequired';
  if (!EMAIL_RE.test(v)) return 'emailInvalid';
  return undefined;
}

export type PasswordRule = 'length' | 'case' | 'number' | 'symbol';

export function passwordChecks(password: string): { id: PasswordRule; met: boolean }[] {
  return [
    { id: 'length', met: password.length >= 8 },
    { id: 'case', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: 'number', met: /\d/.test(password) },
    { id: 'symbol', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

/** 0 (empty) … 4 (every rule met). */
export function passwordScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  return passwordChecks(password).filter((c) => c.met).length as 0 | 1 | 2 | 3 | 4;
}

/** Sign-in only needs a password; sign-up needs 8+ characters and at least 3 of the 4 rules. */
export function validatePassword(value: string, view: AuthView): ErrorCode | undefined {
  if (!value) return 'passwordRequired';
  if (view !== 'signup') return undefined;
  if (value.length < 8) return 'passwordShort';
  if (passwordScore(value) < 3) return 'passwordWeak';
  return undefined;
}

export function validateAuth(view: AuthView, values: AuthValues): AuthErrors {
  const fields = VIEW_FIELDS[view];
  const errors: AuthErrors = {};
  if (fields.includes('name')) errors.name = validateName(values.name);
  if (fields.includes('email')) errors.email = validateEmail(values.email);
  if (fields.includes('password')) errors.password = validatePassword(values.password, view);
  if (fields.includes('terms') && !values.terms) errors.terms = 'termsRequired';
  for (const key of Object.keys(errors) as AuthField[]) {
    if (errors[key] === undefined) delete errors[key];
  }
  return errors;
}
