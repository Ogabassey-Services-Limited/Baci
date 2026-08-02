import { z } from 'zod';

export const cacheInvalidationClaimSchema = z.object({
  attempts: z.number().int().min(1).max(20),
  claim_token: z.string().uuid(),
  generation: z.number().int().positive(),
  merchant_id: z.string().uuid(),
  product_slugs: z.array(z.string().trim().min(1).max(253)).max(100),
  related_identifiers: z.array(z.string().trim().min(1).max(253)).max(40),
  target_id: z.string().trim().min(1).max(253),
  target_kind: z.enum([
    'storefront_slug',
    'storefront_hostname',
    'storefront_product',
  ]),
});

export type CacheInvalidationClaim = z.infer<
  typeof cacheInvalidationClaimSchema
>;
