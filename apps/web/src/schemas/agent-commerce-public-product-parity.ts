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
  catalog_scope: z.enum(['product', 'variant']).optional(),
  image: z.string(),
  name: z.string().min(1),
  price: z.number(),
  url: z.url(),
});

export const publicProductCurrentFeedItemSchema = z.object({
  id: z.string().min(1),
  media: z.array(z.object({ url: z.string() })),
  title: z.string().min(1),
  url: z.url(),
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
  canonical_link: z.url().optional(),
  id: z.string().min(1),
  image_link: z.string(),
  item_group_id: z.string().min(1).optional(),
  link: z.url(),
  price: z.string(),
  sale_price: z.string().optional(),
  title: z.string().min(1),
});

export const publicProductGoogleFeedEnvelopeSchema = z.object({
  rss: z.object({
    channel: z.object({
      item: z
        .union([
          publicProductGoogleFeedItemSchema,
          z.array(publicProductGoogleFeedItemSchema),
        ])
        .optional(),
    }),
  }),
});

const publicProductPdpPresentationShape = {
  image: z.union([z.string(), z.array(z.string()).min(1)]),
  name: z.string().min(1),
  url: z.url(),
};

const publicProductPdpOfferSchema = z.object({
  availability: z.string(),
  price: z.union([z.number(), z.string()]),
  url: z.url().optional(),
});

export const publicProductPdpSchema = z.discriminatedUnion('@type', [
  z.object({
    '@type': z.literal('Product'),
    ...publicProductPdpPresentationShape,
    offers: publicProductPdpOfferSchema,
  }),
  z.object({
    '@type': z.literal('ProductGroup'),
    ...publicProductPdpPresentationShape,
    hasVariant: z.tuple([
      z.object({
        '@type': z.literal('Product'),
        offers: publicProductPdpOfferSchema,
      }),
    ]),
  }),
]);

export type PublicProductApiSample = z.infer<
  typeof publicProductApiProductSchema
>;
export type PublicProductComparableSurface = z.infer<
  typeof publicProductComparableSurfaceSchema
>;
