import { z } from 'zod';

export const storefrontAuthMerchantRpcRowSchema = z.object({
  business_name: z.string(),
  custom_domain: z.preprocess(
    (value) => (typeof value === 'string' ? value : null),
    z.string().nullable()
  ),
  id: z.string(),
  is_published: z.boolean(),
  slug: z.string(),
});

export type StorefrontAuthMerchant = z.infer<
  typeof storefrontAuthMerchantRpcRowSchema
>;
