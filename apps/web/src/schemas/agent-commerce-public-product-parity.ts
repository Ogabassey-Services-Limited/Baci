import { z } from 'zod';

const publicProductAvailabilitySchema = z.enum(['in_stock', 'out_of_stock']);

const publicProductApiProductSchema = z.object({
  availability: publicProductAvailabilitySchema,
  has_condition_offers: z.boolean(),
  has_variants: z.boolean(),
  id: z.string().min(1),
  image: z.string(),
  name: z.string().min(1),
  price: z.number(),
});

export const publicProductApiResponseSchema = z.object({
  products: z.array(publicProductApiProductSchema),
});

export const publicProductComparableSurfaceSchema = z.object({
  availability: publicProductAvailabilitySchema,
  image: z.string(),
  name: z.string().min(1),
  price: z.number(),
  url: z.string().url(),
});

export const publicProductCurrentFeedItemSchema = z.object({
  id: z.string().min(1),
  media: z.array(z.object({ url: z.string() })),
  title: z.string().min(1),
  url: z.string().url(),
  variants: z
    .array(
      z.object({
        availability: z.object({ status: publicProductAvailabilitySchema }),
        price: z.object({ amount: z.number() }),
      })
    )
    .min(1),
});

export const publicProductGoogleFeedItemSchema = z.object({
  availability: publicProductAvailabilitySchema,
  id: z.string().min(1),
  image_link: z.string(),
  link: z.string().url(),
  price: z.string(),
  sale_price: z.string().optional(),
  title: z.string().min(1),
});

export const publicProductPdpSchema = z.object({
  '@type': z.literal('Product'),
  image: z.union([z.string(), z.array(z.string()).min(1)]),
  name: z.string().min(1),
  offers: z.object({
    availability: z.string(),
    price: z.union([z.number(), z.string()]),
    url: z.string().url(),
  }),
  url: z.string().url(),
});

export type PublicProductApiSample = z.infer<
  typeof publicProductApiProductSchema
>;
export type PublicProductComparableSurface = z.infer<
  typeof publicProductComparableSurfaceSchema
>;
