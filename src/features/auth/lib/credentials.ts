import { z } from 'zod';

export const Username = z
  .string()
  .trim()
  .transform((value) => value.normalize('NFC'))
  .pipe(
    z
      .string()
      .min(1)
      .max(40)
      .refine((value) => !/[\p{Cc}\p{Cs}]/u.test(value)),
  );
/** ILIKE treats % and _ as wildcards; username lookup must match them literally. */
export const usernamePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&');
export const Email = z.string().trim().toLowerCase().email().max(254);
// Supabase Auth hashes passwords. Match bcrypt's 72-byte limit without trimming the secret.
export const Password = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);
export const SignupCredentials = z.object({ email: Email, username: Username, password: Password });
export type SignupInput = z.infer<typeof SignupCredentials>;
