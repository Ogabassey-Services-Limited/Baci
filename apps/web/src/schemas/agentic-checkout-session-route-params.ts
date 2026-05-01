import { z } from 'zod';

export const agenticCheckoutSessionRouteParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Session id is required')
    .max(255, 'Session id is too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Session id contains invalid characters'),
});
