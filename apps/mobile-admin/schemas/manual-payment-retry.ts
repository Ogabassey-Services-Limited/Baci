import { z } from 'zod';

export const manualPaymentRetrySchema = z.object({
  fingerprint: z.string().min(1),
  idempotencyKey: z.uuid(),
});

export type ManualPaymentRetry = z.infer<typeof manualPaymentRetrySchema>;
