import { z } from 'zod';

export const adminMerchantsQuerySchema = z.object({
  sortBy: z.enum(['gmv', 'orders', 'joined']).default('gmv'),
});

export type AdminMerchantsSortBy = z.infer<
  typeof adminMerchantsQuerySchema
>['sortBy'];
