import { z } from 'zod';

export const jumiaMerchantIdQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
});

export const jumiaOrderIdParamSchema = z.object({
  id: z.string().min(1),
});

export type JumiaOrderIdParam = z.infer<typeof jumiaOrderIdParamSchema>;
