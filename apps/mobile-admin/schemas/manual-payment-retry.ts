import { z } from 'zod';

export const manualPaymentRetrySchema = z.object({
  createdAt: z.number().int().nonnegative().default(0),
  fingerprint: z.string().min(1),
  idempotencyKey: z.uuid(),
  paymentMethod: z.string().min(1).optional(),
  reference: z.string().nullable().optional(),
  status: z.enum(['pending', 'completed']).default('pending'),
});

export type ManualPaymentRetry = z.infer<typeof manualPaymentRetrySchema>;
