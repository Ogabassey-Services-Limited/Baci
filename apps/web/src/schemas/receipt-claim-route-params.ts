import { z } from 'zod';

export const receiptClaimRouteParamsSchema = z.object({
  token: z
    .string()
    .trim()
    .min(8, 'Receipt claim token is too short')
    .max(256, 'Receipt claim token is too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Receipt claim token is invalid'),
});
