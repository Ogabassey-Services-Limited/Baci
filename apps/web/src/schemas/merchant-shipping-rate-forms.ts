/**
 * Dashboard form schemas — merchant-authored zone/rate CRUD input, validated
 * in `app/dashboard/settings/shipping/actions.ts`.
 *
 * Split out from `@/schemas/merchant-shipping-rates` (which owns the
 * storefront RPC read schema) to keep both files under the repo's 300-line
 * modularity limit; the two share the runtime enum tuples so the allowed
 * `kind`/`condition_type` values can't drift between read and write paths.
 *
 * These schemas intentionally have NO `currency` field: the server always
 * stamps it from `resolveMerchantCurrencyConfig(merchant)` and a
 * client-submitted value is never trusted, so there is nothing to validate.
 */

import { z } from 'zod';
import {
  MERCHANT_SHIPPING_CONDITION_TYPES,
  MERCHANT_SHIPPING_RATE_KINDS,
} from '@/schemas/merchant-shipping-rates';

const ISO_COUNTRY_CODE = /^[A-Za-z]{2}$/;
const ISO_SUBDIVISION_CODE = /^[A-Za-z]{2}-[A-Za-z0-9]{1,3}$/;

/** One country/subdivision entry attached to a zone in the editor form. */
export const zoneLocationFormSchema = z
  .object({
    countryCode: z
      .string()
      .regex(ISO_COUNTRY_CODE, 'Invalid country code')
      .transform((value) => value.toUpperCase()),
    // Empty selection = whole country, so `undefined`/`''` normalize to null.
    subdivisionCode: z
      .string()
      .regex(ISO_SUBDIVISION_CODE, 'Invalid subdivision code')
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .refine(
    (location) =>
      !location.subdivisionCode ||
      location.subdivisionCode.startsWith(`${location.countryCode}-`),
    {
      message: 'Subdivision must belong to the selected country',
      path: ['subdivisionCode'],
    }
  );

export type ZoneLocationFormInput = z.infer<typeof zoneLocationFormSchema>;

/**
 * Create/rename a zone and replace its location set. The action layer owns
 * the rest-of-world guard (its locations are always empty by definition and
 * a submission that tries to attach locations to it must be rejected before
 * this schema is ever reached).
 */
export const zoneFormSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Zone name is required')
    .max(120, 'Zone name is too long'),
  locations: z.array(zoneLocationFormSchema).max(200).default([]),
});

export type ZoneFormInput = z.infer<typeof zoneFormSchema>;

const pickupAddressFormSchema = z.object({
  label: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  countryCode: z
    .string()
    .regex(ISO_COUNTRY_CODE, 'Invalid country code')
    .transform((value) => value.toUpperCase())
    .optional(),
  instructions: z.string().trim().max(500).optional(),
});

const nullableAmountFormSchema = z.coerce
  .number()
  .nonnegative('Must be zero or greater')
  .nullable()
  .optional()
  .transform((value) => value ?? null);

// A provided ETA must be a POSITIVE whole number of days. `null` (unspecified)
// is the ONLY "unknown ETA" signal — it is what makes the storefront emit the
// `estimatedDays: 0` sentinel (MERCHANT_RATE_UNKNOWN_ESTIMATED_DAYS) that
// ranking penalizes. Forbidding `0` here removes the ambiguity between an
// unknown ETA and a would-be same-day rate: a real ETA is always >= 1 day.
const nullableDaysFormSchema = z.coerce
  .number()
  .int('Must be a whole number')
  .positive('Must be at least 1 day')
  .nullable()
  .optional()
  .transform((value) => value ?? null);

/**
 * Create/update a rate. Validation mirrors the DB check constraints
 * (`merchant_shipping_rates_tier_bounds`, `..._delivery_days_order`) so bad
 * input is rejected in the dashboard instead of surfacing as a 23514.
 */
export const rateFormSchema = z
  .object({
    id: z.uuid().optional(),
    zoneId: z.uuid('Select a zone'),
    name: z
      .string()
      .trim()
      .min(1, 'Rate name is required')
      .max(120, 'Rate name is too long'),
    kind: z.enum(MERCHANT_SHIPPING_RATE_KINDS),
    baseAmount: z.coerce.number().nonnegative('Amount cannot be negative'),
    conditionType: z.enum(MERCHANT_SHIPPING_CONDITION_TYPES),
    minSubtotal: nullableAmountFormSchema,
    maxSubtotal: nullableAmountFormSchema,
    freeOverAmount: z.coerce
      .number()
      .positive('Must be greater than zero')
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    deliveryMinDays: nullableDaysFormSchema,
    deliveryMaxDays: nullableDaysFormSchema,
    pickupAddress: pickupAddressFormSchema.nullable().optional().default(null),
    sortOrder: z.coerce.number().int().default(0),
    active: z.boolean().default(true),
  })
  .refine(
    (rate) =>
      rate.minSubtotal === null ||
      rate.maxSubtotal === null ||
      rate.maxSubtotal > rate.minSubtotal,
    {
      message: 'Maximum subtotal must be greater than minimum subtotal',
      path: ['maxSubtotal'],
    }
  )
  .refine(
    (rate) =>
      rate.deliveryMinDays === null ||
      rate.deliveryMaxDays === null ||
      rate.deliveryMaxDays >= rate.deliveryMinDays,
    {
      message: 'Maximum delivery days must be at least the minimum',
      path: ['deliveryMaxDays'],
    }
  )
  .refine(
    // A pickup rate needs a REAL collection address, not just a non-null
    // object. `pickupAddress.address` is already trimmed by its field schema,
    // so `{}`, `{ address: '' }`, and all-whitespace input all collapse to an
    // empty string and are rejected here.
    (rate) =>
      rate.kind !== 'pickup' ||
      (typeof rate.pickupAddress?.address === 'string' &&
        rate.pickupAddress.address.length > 0),
    {
      message: 'Pickup rates require a pickup address',
      path: ['pickupAddress'],
    }
  );

export type RateFormInput = z.infer<typeof rateFormSchema>;
