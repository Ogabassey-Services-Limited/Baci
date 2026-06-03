import { z } from 'zod';

export const adminMerchantRouteParamsSchema = z.object({
  merchantId: z.uuid('Invalid merchant ID'),
});

export type AdminMerchantRouteParams = z.infer<
  typeof adminMerchantRouteParamsSchema
>;
