import { z } from 'zod';

const STOREFRONT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const storefrontProductsRouteParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Store slug is required')
    .max(100, 'Store slug must be 100 characters or fewer')
    .regex(
      STOREFRONT_SLUG_REGEX,
      'Store slug must contain lowercase letters, numbers, and single hyphens'
    ),
});

export type StorefrontProductsRouteParams = z.infer<
  typeof storefrontProductsRouteParamsSchema
>;
