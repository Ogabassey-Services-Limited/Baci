import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize-core';

/**
 * Merchant-authored category text, sanitized BEFORE it is length-checked.
 *
 * Sanitizing in the route after validation let a name of pure markup
 * (`<b></b>`) pass `.min(1)` and then reach the insert as an empty string —
 * `categories.name` is only NOT NULL, so Postgres happily stored a blank
 * category. Doing it inside the schema means the value the handler receives is
 * already the value that will be written, and `.min(1)` guards that value.
 */
export function sanitizedCategoryText(max: number) {
  return z
    .string()
    .transform((value) => sanitizeText(value, Number.POSITIVE_INFINITY).trim())
    .refine((value) => value.length <= max, {
      message: `Must be at most ${max} characters`,
    });
}

/** Required text: must survive sanitization with something left. */
export function requiredCategoryText(max: number) {
  return sanitizedCategoryText(max).refine((value) => value.length > 0, {
    message: 'Must contain text that is not markup',
  });
}
