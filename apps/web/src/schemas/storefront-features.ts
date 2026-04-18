import { z } from 'zod';

export const storefrontFeaturesQuerySchema = z
  .object({
    merchantId: z.string().uuid({ message: 'Invalid merchantId' }).optional(),
    slug: z.string().trim().min(1).max(255).optional(),
  })
  .refine((value) => value.merchantId || value.slug, {
    message: 'merchantId or slug is required',
  });

export type StorefrontFeaturesQuery = z.infer<
  typeof storefrontFeaturesQuerySchema
>;
