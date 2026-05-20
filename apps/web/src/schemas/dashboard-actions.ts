import { z } from 'zod';

export const dashboardMerchantActionArgsSchema = z.object({
  merchantId: z.string().trim().min(1).max(128),
});

export const dashboardRecentSalesArgsSchema =
  dashboardMerchantActionArgsSchema.extend({
    limit: z.number().int().min(1).max(50).default(5),
  });
