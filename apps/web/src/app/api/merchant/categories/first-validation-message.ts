import type { ZodError } from 'zod';

/** Return the first actionable validation failure for the merchant UI. */
export function firstValidationMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
