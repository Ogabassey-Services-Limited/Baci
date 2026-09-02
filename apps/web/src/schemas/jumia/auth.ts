/**
 * Jumia Vendor Center API — Auth schemas
 */

import { z } from 'zod';

/**
 * Accepts a number or a numeric string (digits only), rejects booleans/arrays.
 * Preserves `.int().positive()` semantics after conversion.
 */
const numericOrString = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.int().positive());

export const JumiaTokenResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  expires_in: numericOrString,
  refresh_token: z.string().trim().min(1).optional(),
  refresh_expires_in: numericOrString.optional(),
  token_type: z.string().trim().min(1),
});

export const JumiaSelfAuthorizationTokenResponseSchema =
  JumiaTokenResponseSchema.extend({
    refresh_token: z.string().trim().min(1),
    refresh_expires_in: numericOrString,
  });

export const JumiaTokenErrorSchema = z.object({
  error: z.string().trim().min(1),
  error_description: z.string().trim().min(1),
});

export type JumiaTokenResponse = z.infer<typeof JumiaTokenResponseSchema>;
export type JumiaSelfAuthorizationTokenResponse = z.infer<
  typeof JumiaSelfAuthorizationTokenResponseSchema
>;
export type JumiaTokenError = z.infer<typeof JumiaTokenErrorSchema>;
