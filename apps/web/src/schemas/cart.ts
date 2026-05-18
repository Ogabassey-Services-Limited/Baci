import { z } from 'zod';

const variantIdSchema = z
  .string()
  .uuid({ message: 'variantId/variant_id must be a UUID' });

const cartItemSchema = z
  .object({
    id: z.string(),
    price: z.number(),
    variantId: variantIdSchema.optional(),
    variant_id: variantIdSchema.optional(),
  })
  .superRefine((item, ctx) => {
    if (
      item.variantId &&
      item.variant_id &&
      item.variantId !== item.variant_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'conflicting variantId and variant_id',
        path: ['variant_id'],
      });
    }
  });

export const cartValidateSchema = z.object({
  productIds: z.array(z.string()).max(50).optional(),
  cartItems: z.array(cartItemSchema).max(50).optional(),
});
