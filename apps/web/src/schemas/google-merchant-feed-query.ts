import { z } from 'zod';

const MerchantSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9_-]+$/);

export const googleMerchantFeedQuerySchema = z
  .object({
    merchant_id: z.uuid().optional(),
    merchant_slug: MerchantSlugSchema.optional(),
  })
  .refine((data) => data.merchant_id || data.merchant_slug, {
    error: 'merchant_id or merchant_slug parameter is required',
  })
  .refine((data) => !(data.merchant_id && data.merchant_slug), {
    error: 'Provide exactly one of merchant_id or merchant_slug, not both',
  });

export type GoogleMerchantFeedQuery = z.infer<
  typeof googleMerchantFeedQuerySchema
>;
