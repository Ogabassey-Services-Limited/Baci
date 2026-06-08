import { z } from 'zod';

export const merchantSalesSummaryCronQuerySchema = z.object({
  date: z.iso.date().optional(),
  period: z.enum(['daily', 'weekly']).optional().default('daily'),
});

export type MerchantSalesSummaryCronQuery = z.infer<
  typeof merchantSalesSummaryCronQuerySchema
>;
