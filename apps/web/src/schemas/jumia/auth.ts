/**
 * Jumia Vendor Center API — Auth schemas
 */

import { z } from 'zod';

export const JumiaTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive(),
  refresh_token: z.string().min(1),
  refresh_expires_in: z.coerce.number().int().positive(),
  token_type: z.string().min(1),
});

export const JumiaTokenErrorSchema = z.object({
  error: z.string().min(1),
  error_description: z.string().min(1),
});

export type JumiaTokenResponse = z.infer<typeof JumiaTokenResponseSchema>;
export type JumiaTokenError = z.infer<typeof JumiaTokenErrorSchema>;
