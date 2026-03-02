import { z } from 'zod';

export const socialProofStatsSchema = z.object({
  weekSales: z.number().nullable(),
  dailySales: z.number().nullable(),
  recentPurchases: z.array(
    z.object({
      city: z.string().nullable(),
      created_at: z.string(),
      product_name: z.string(),
    })
  ),
});

export type SocialProofStats = z.infer<typeof socialProofStatsSchema>;
