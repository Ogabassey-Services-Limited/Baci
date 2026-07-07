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

/**
 * `event_data` is a free-form payload whose shape varies by event type, but a
 * handful of fields are read directly by the route (purchase value/currency,
 * page URL). Validate those specifically — a 3-letter ISO 4217 code for
 * `currency` — while allowing other event-specific fields to pass through.
 */
export const platformEventDataSchema = z.looseObject({
  value: z.number().nonnegative().optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
    .transform((value) => value.toUpperCase())
    .optional(),
});

export const platformEventRequestSchema = z.object({
  event_type: platformEventTypeSchema,
  event_data: platformEventDataSchema.optional(),
  merchant_id: z.string().optional(),
  session_id: z.string().optional(),
  page_url: z.string().optional(),
  referrer: z.string().optional(),
});

export type PlatformEventRequestInput = z.infer<
  typeof platformEventRequestSchema
>;
