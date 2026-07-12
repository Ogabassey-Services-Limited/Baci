/**
 * Map computed merchant rates onto the existing `ShippingQuote` shape so they
 * merge seamlessly with carrier (GIGL/Topship) quotes in the quotes pipeline.
 *
 * Field decisions:
 *   - `id`: `mrate_<rate.id>` — namespaced so the order route can detect a
 *     merchant-rate selection and recompute the fee server-side.
 *   - `provider`: `'MERCHANT'` — a display-only union member. It is deliberately
 *     NOT in `SHIPPING_PROVIDER_CODES`, so carrier-only paths (booking,
 *     `isShippingProviderCode`) stay type-safe and never try to book it.
 *   - `estimatedDays`: derived from `deliveryMin/MaxDays` the same way Topship
 *     derives it (round the midpoint of a range). When the merchant configured
 *     no days we emit `0` as an "unknown estimate" sentinel and omit the range —
 *     callers must not render "0 days".
 *   - `expiresAt`: merchant rates are recomputed from config on every request
 *     and authoritatively re-validated at order time, so they never really
 *     expire. We stamp a long TTL (`Date.now() + 24h`) purely to satisfy the
 *     client's "refresh expired quotes" logic within a checkout session.
 */

import {
  MERCHANT_PROVIDER_CODE,
  type ShippingQuote,
} from '@/lib/shipping/types';
import type { ComputedMerchantRate } from './types';

export const MERCHANT_RATE_ID_PREFIX = 'mrate_';
export const MERCHANT_SHIP_SERVICE_TIER = 'standard';
export const MERCHANT_PICKUP_SERVICE_TIER = 'pickup';
/** Sentinel `estimatedDays` when the merchant configured no delivery days. */
export const MERCHANT_RATE_UNKNOWN_ESTIMATED_DAYS = 0;
/** Long TTL so merchant rates never expire mid-checkout (24 hours). */
export const MERCHANT_RATE_QUOTE_TTL_MS = 24 * 60 * 60 * 1000;

interface DeliveryEstimate {
  estimatedDays: number;
  minDays?: number;
  maxDays?: number;
  deliveryRange?: string;
}

function formatDays(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}

function deriveDeliveryEstimate(
  computed: ComputedMerchantRate
): DeliveryEstimate {
  const min = computed.rate.deliveryMinDays;
  const max = computed.rate.deliveryMaxDays;

  if (min !== null && max !== null) {
    return {
      estimatedDays: Math.round((min + max) / 2),
      minDays: min,
      maxDays: max,
      deliveryRange: min === max ? formatDays(min) : `${min}-${max} days`,
    };
  }
  if (min !== null) {
    return { estimatedDays: min, minDays: min, deliveryRange: formatDays(min) };
  }
  if (max !== null) {
    return { estimatedDays: max, maxDays: max, deliveryRange: formatDays(max) };
  }
  return { estimatedDays: MERCHANT_RATE_UNKNOWN_ESTIMATED_DAYS };
}

function derivePickupDisplay(computed: ComputedMerchantRate): {
  stationName?: string;
  stationAddress?: string;
  stationInstructions?: string;
} {
  if (computed.rate.kind !== 'pickup') {
    return {};
  }
  const pickup = computed.rate.pickupAddress;
  const stationName = pickup?.label?.trim() || computed.rate.name;
  const stationAddress = [pickup?.address, pickup?.city, pickup?.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');
  // Surface the merchant's collection directions so shoppers see how to pick up
  // before selecting the rate — otherwise they'd be dropped with `rawResponse`.
  const stationInstructions = pickup?.instructions?.trim();

  return {
    stationName,
    ...(stationAddress ? { stationAddress } : {}),
    ...(stationInstructions ? { stationInstructions } : {}),
  };
}

function toShippingQuote(
  computed: ComputedMerchantRate,
  expiresAt: Date
): ShippingQuote {
  const isPickup = computed.rate.kind === 'pickup';
  const estimate = deriveDeliveryEstimate(computed);
  const pickupDisplay = derivePickupDisplay(computed);

  return {
    id: `${MERCHANT_RATE_ID_PREFIX}${computed.rate.id}`,
    provider: MERCHANT_PROVIDER_CODE,
    serviceTier: isPickup
      ? MERCHANT_PICKUP_SERVICE_TIER
      : MERCHANT_SHIP_SERVICE_TIER,
    carrierName: computed.rate.name,
    displayName: computed.rate.name,
    estimatedDays: estimate.estimatedDays,
    price: computed.amount,
    currency: computed.rate.currency,
    // Merchant rates carry no carrier pickup leg and no carrier insurance.
    pickupIncluded: false,
    insuranceIncluded: false,
    isStationPickup: isPickup,
    expiresAt,
    rawResponse: computed,
    ...(estimate.minDays !== undefined ? { minDays: estimate.minDays } : {}),
    ...(estimate.maxDays !== undefined ? { maxDays: estimate.maxDays } : {}),
    ...(estimate.deliveryRange !== undefined
      ? { deliveryRange: estimate.deliveryRange }
      : {}),
    ...(pickupDisplay.stationName !== undefined
      ? { stationName: pickupDisplay.stationName }
      : {}),
    ...(pickupDisplay.stationAddress !== undefined
      ? { stationAddress: pickupDisplay.stationAddress }
      : {}),
    ...(pickupDisplay.stationInstructions !== undefined
      ? { stationInstructions: pickupDisplay.stationInstructions }
      : {}),
  };
}

/**
 * Map computed merchant rates to `ShippingQuote`s. `now` is injectable for
 * deterministic `expiresAt` in tests.
 */
export function computedRatesToShippingQuotes(
  computed: ComputedMerchantRate[],
  options: { now?: number } = {}
): ShippingQuote[] {
  const nowMs = options.now ?? Date.now();
  const expiresAt = new Date(nowMs + MERCHANT_RATE_QUOTE_TTL_MS);
  return computed.map((entry) => toShippingQuote(entry, expiresAt));
}
