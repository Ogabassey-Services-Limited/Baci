import { z } from 'zod';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// First/last char must be alphanumeric; middle chars may include single
// separators. Consecutive separators are rejected by a separate refine()
// below so we can surface a more specific message for that case.
const USERNAME_FORMAT_PATTERN = /^[a-z0-9][a-z0-9._]*[a-z0-9]$/i;
const CONSECUTIVE_SEPARATOR_PATTERN = /[._]{2}/;

/**
 * Client-side UX validation only. The `set_customer_username` RPC is the
 * authoritative validator — it re-checks format and enforces per-merchant
 * case-insensitive uniqueness server-side.
 */
export const UsernameSchema = z
  .string()
  .trim()
  .min(
    USERNAME_MIN_LENGTH,
    `Use ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`
  )
  .max(
    USERNAME_MAX_LENGTH,
    `Use ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`
  )
  .regex(
    USERNAME_FORMAT_PATTERN,
    'Start and end with a letter or number. Only letters, numbers, . and _ are allowed.'
  )
  .refine((value) => !CONSECUTIVE_SEPARATOR_PATTERN.test(value), {
    message: 'Avoid consecutive . or _ characters',
  });

export type Username = z.infer<typeof UsernameSchema>;

/** Returns a friendly validation message, or null when the username is valid. */
export function getUsernameValidationError(value: string): string | null {
  const result = UsernameSchema.safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? 'Enter a valid username';
}
