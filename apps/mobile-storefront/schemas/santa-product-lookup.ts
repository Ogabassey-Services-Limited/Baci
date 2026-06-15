import { z } from 'zod';

const santaProductLookupResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().finite().nonnegative(),
  image: z.string().optional(),
  manage_stock: z.boolean().optional(),
  stock: z.number().finite().nonnegative().optional(),
});

export const santaProductLookupResponseSchema = z.object({
  product: santaProductLookupResultSchema.nullable(),
});

export type SantaProductLookupResult = z.infer<
  typeof santaProductLookupResultSchema
>;
