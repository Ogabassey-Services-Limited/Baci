/**
 * Jumia Vendor Center API — Standard API error schema
 */

import { z } from 'zod';

export const JumiaApiErrorSchema = z.object({
  code: z.string().min(1, 'Error code is required'),
  data: z
    .array(
      z.object({
        code: z.string().min(1, 'Constraint error code is required'),
        message: z.string().min(1, 'Constraint error message is required'),
      })
    )
    .min(1, 'Error data must contain at least one constraint')
    .optional(),
});

export type JumiaApiError = z.infer<typeof JumiaApiErrorSchema>;
