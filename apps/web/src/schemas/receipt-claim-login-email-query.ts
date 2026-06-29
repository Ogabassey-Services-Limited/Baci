import { z } from 'zod';

export const receiptClaimLoginEmailQuerySchema = z.object({
  source: z.enum(['app', 'unknown', 'web']).optional(),
});

export type ReceiptClaimLoginEmailQuery = z.infer<
  typeof receiptClaimLoginEmailQuerySchema
>;
