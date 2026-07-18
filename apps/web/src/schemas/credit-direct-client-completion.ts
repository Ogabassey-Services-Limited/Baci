import { z } from 'zod';

export const creditDirectClientCompletionSchema = z
  .object({
    checkoutTransactionId: z.string().trim().min(1).max(200).optional(),
    orderId: z.uuid(),
    sessionId: z.string().trim().min(1).max(200).optional(),
    tracking_token: z.string().trim().min(1).max(512).optional(),
  })
  .strict()
  .refine(
    ({ checkoutTransactionId, sessionId }) =>
      Boolean(checkoutTransactionId || sessionId),
    { message: 'A Credit Direct transaction or session reference is required' }
  );
