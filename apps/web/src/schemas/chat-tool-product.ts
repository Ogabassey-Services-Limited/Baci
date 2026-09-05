import z from 'zod';

/** Raw catalog tool result, validated before presentation normalization. */
export const chatToolProductSchema = z
  .object({
    brand: z.string().nullable(),
    category: z.string().nullable(),
    description: z.string().nullable(),
    has_variants: z.boolean(),
    id: z.string(),
    image_url: z.string().nullable(),
    manage_stock: z.boolean(),
    name: z.string(),
    price: z.number(),
    slug: z.string().nullable(),
    status: z.literal('active'),
    stock: z.number().int().nullable(),
  })
  .passthrough();
