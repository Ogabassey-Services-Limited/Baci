/**
 * Jumia Vendor Center API — Standard API error schema
 */

import { z } from 'zod';

export const JumiaApiErrorSchema = z.object({
  code: z.string().min(1),
  data: z
    .array(
      z.object({
        code: z.string().min(1),
        message: z.string().min(1),
      })
    )
    .min(1)
    .optional(),
});

export type JumiaApiError = z.infer<typeof JumiaApiErrorSchema>;
