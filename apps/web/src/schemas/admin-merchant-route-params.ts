import { z } from 'zod';

export const adminMerchantRouteParamsSchema = z.object({
  merchantId: z.string().uuid('Invalid merchant ID'),
});

export type AdminMerchantRouteParams = z.infer<
  typeof adminMerchantRouteParamsSchema
>;
