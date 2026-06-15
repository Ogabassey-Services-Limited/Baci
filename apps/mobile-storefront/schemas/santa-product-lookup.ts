import { z } from 'zod';

const santaProductLookupResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().finite().nonnegative(),
  image: z.nullish(z.string()),
  manage_stock: z.nullish(z.boolean()),
  slug: z.nullish(z.string()),
  stock: z.nullish(z.number().finite().nonnegative()),
});

export const santaProductLookupResponseSchema = z.object({
  product: santaProductLookupResultSchema.nullable(),
});

export type SantaProductLookupResult = z.infer<
  typeof santaProductLookupResultSchema
>;
