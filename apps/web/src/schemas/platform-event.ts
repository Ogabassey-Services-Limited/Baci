import { z } from 'zod';

/**
 * Platform-level event types tracked via POST /api/platform/events.
 * `PlatformEventType` in the route handler is derived from this schema.
 */
export const platformEventTypeSchema = z.enum([
  'landing_page_view',
  'pricing_page_view',
  'merchant_signup_started',
  'merchant_signup_completed',
  'merchant_first_sale',
  'merchant_store_published',
  'platform_checkout',
  'platform_purchase',
]);

/** Public platform telemetry accepts only non-sensitive, documented facts. */
export const platformEventDataSchema = z.strictObject({
  business_name: z.string().trim().min(1).max(200).optional(),
  business_type: z.string().trim().min(1).max(100).optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
    .transform((value) => value.toUpperCase())
    .optional(),
  order_id: z.string().trim().min(1).max(200).optional(),
  store_slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)
    .optional(),
  value: z.number().finite().nonnegative().optional(),
});

export const platformEventRequestSchema = z.strictObject({
  event_id: z.string().min(1).max(500).optional(),
  event_type: platformEventTypeSchema,
  event_data: platformEventDataSchema.optional(),
  merchant_id: z.uuid().optional(),
  session_id: z.string().min(1).max(100).optional(),
  page_url: z.url().max(2_000).optional(),
  referrer: z.url().max(2_000).optional(),
});

export type PlatformEventRequestInput = z.infer<
  typeof platformEventRequestSchema
>;
