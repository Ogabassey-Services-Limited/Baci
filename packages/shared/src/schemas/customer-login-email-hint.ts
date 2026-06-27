import { z } from 'zod';

export const CustomerLoginEmailHintSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase());

export function sanitizeCustomerLoginEmailHint(
  email: string | string[] | null | undefined
) {
  const candidates = Array.isArray(email) ? email : [email];

  for (const candidate of candidates) {
    const parsedEmail = CustomerLoginEmailHintSchema.safeParse(candidate);
    if (parsedEmail.success) {
      return parsedEmail.data;
    }
  }

  return '';
}
