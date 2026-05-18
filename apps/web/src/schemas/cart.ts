import { z } from 'zod';

export const cartValidateSchema = z.object({
  productIds: z.array(z.string()).max(50).optional(),
  cartItems: z
    .array(
      z.object({
        id: z.string(),
        price: z.number(),
        variantId: z.string().optional(),
        variant_id: z.string().optional(),
      })
    )
    .max(50)
    .optional(),
});
