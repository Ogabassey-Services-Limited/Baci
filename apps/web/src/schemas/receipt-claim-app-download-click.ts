import { z } from 'zod';

export const receiptClaimAppDownloadClickBodySchema = z.object({
  target: z.enum(['app_store', 'play_store']),
});

export type ReceiptClaimAppDownloadClickBody = z.infer<
  typeof receiptClaimAppDownloadClickBodySchema
>;
