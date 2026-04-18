import type { z } from 'zod';
import type { storefrontProductsQuerySchema } from '@/schemas/storefront-products-query';

export type StorefrontProductsQuery = z.infer<
  typeof storefrontProductsQuerySchema
>;
