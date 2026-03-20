import z from 'zod';

const nullableTextSchema = z.string().nullable().optional();

export const PlatformSettingsUpdateSchema = z.object({
  google_analytics_id: nullableTextSchema,
  ga4_api_secret: nullableTextSchema,
  facebook_pixel_id: nullableTextSchema,
  facebook_capi_token: nullableTextSchema,
  tiktok_pixel_id: nullableTextSchema,
  tiktok_access_token: nullableTextSchema,
  snapchat_pixel_id: nullableTextSchema,
  snapchat_capi_token: nullableTextSchema,
  twitter_pixel_id: nullableTextSchema,
  platform_fee_percentage: z.coerce.number().nonnegative().optional(),
  platform_fee_flat: z.coerce.number().nonnegative().optional(),
  payment_processor_fee_percentage: z.coerce.number().nonnegative().optional(),
  payment_processor_fee_flat: z.coerce.number().nonnegative().optional(),
  platform_name: z.string().optional(),
  platform_logo_url: nullableTextSchema,
  support_email: z
    .string()
    .email('support_email must be a valid email address')
    .nullable()
    .optional(),
  support_phone: nullableTextSchema,
  enable_merchant_signups: z.boolean().optional(),
  enable_custom_domains: z.boolean().optional(),
  enable_analytics_export: z.boolean().optional(),
  maintenance_mode: z.boolean().optional(),
  maintenance_message: nullableTextSchema,
});
