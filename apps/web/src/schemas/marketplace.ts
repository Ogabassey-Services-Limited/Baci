import { z } from 'zod';

export const jumiaMerchantIdQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
});
