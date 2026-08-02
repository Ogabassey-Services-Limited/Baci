import type { CarrierProviderId } from '@baci/shared/constants';

/**
 * Merchant-configured shipping rate types.
 *
 * These interfaces mirror the DB schema (`merchant_shipping_zones`,
 * `merchant_shipping_zone_locations`, `merchant_shipping_rates`) in camelCase.
 * The storefront RPC (`get_storefront_shipping_rates`) returns raw snake_case
 * jsonb; parsing/normalizing to these shapes is the job of
 * `storefrontShippingRatesPayloadSchema` in
 * `@/schemas/merchant-shipping-rates`.
 *
 * Pure type file — no runtime logic (coverage exemption per repo conventions).
 * The `MerchantRateKind` / `MerchantRateConditionType` unions are the single
 * source of truth; the corresponding Zod schemas consume their shared runtime
 * constants so the compile-time and runtime contracts cannot drift.
 */

/** `merchant_shipping_rates.kind` — a shippable rate vs. a local-pickup rate. */
export type MerchantRateKind = 'ship' | 'pickup';

/** `merchant_shipping_rates.condition_type` — always-on vs. subtotal tier. */
export type MerchantRateConditionType = 'always' | 'price_tier';

/** Carrier settings that a merchant can opt into for live quote rates. */
export type MerchantCarrierProviderId = CarrierProviderId;

/** A merchant delivery zone (`merchant_shipping_zones`). */
export interface MerchantShippingZone {
  id: string;
  name: string;
  /** The auto-created catch-all zone. Matches any destination at specificity 0. */
  isRestOfWorld: boolean;
  active: boolean;
}

/**
 * A country/subdivision entry attached to a zone
 * (`merchant_shipping_zone_locations`).
 */
export interface MerchantShippingZoneLocation {
  zoneId: string;
  /** ISO 3166-1 alpha-2 (normalized to uppercase by the matcher). */
  countryCode: string;
  /** ISO 3166-2 subdivision (e.g. `NG-LA`); `null` = the whole country. */
  subdivisionCode: string | null;
}

/** Display info stored in `merchant_shipping_rates.pickup_address` (jsonb). */
export interface MerchantPickupAddress {
  label?: string;
  address?: string;
  city?: string;
  state?: string;
  countryCode?: string;
  instructions?: string;
}

/** A merchant shipping/pickup rate (`merchant_shipping_rates`). */
export interface MerchantShippingRate {
  id: string;
  zoneId: string;
  name: string;
  kind: MerchantRateKind;
  /** ISO 4217 currency code, stamped from the merchant's currency config. */
  currency: string;
  baseAmount: number;
  conditionType: MerchantRateConditionType;
  /** Tier lower bound, inclusive. `null` = no lower bound. */
  minSubtotal: number | null;
  /** Tier upper bound, exclusive. `null` = unbounded. */
  maxSubtotal: number | null;
  /** When the subtotal reaches this, the rate is free. `null` = never free. */
  freeOverAmount: number | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  pickupAddress: MerchantPickupAddress | null;
  sortOrder: number;
  active: boolean;
}

/** Output of `computeMerchantRates`: a rate plus its resolved fee. */
export interface ComputedMerchantRate {
  rate: MerchantShippingRate;
  /** Final fee for this checkout (0 when free-over-threshold applied). */
  amount: number;
  /** True when `freeOverAmount` triggered the zero fee. */
  isFree: boolean;
}

/**
 * The `get_storefront_shipping_rates` RPC payload shape (post-normalization).
 * Raw jsonb is snake_case; this is what the engine consumes.
 */
export interface StorefrontShippingRatesPayload {
  zones: MerchantShippingZone[];
  locations: MerchantShippingZoneLocation[];
  rates: MerchantShippingRate[];
  /**
   * Carrier integrations the merchant explicitly enabled. Empty means their
   * own delivery rates and pickup are the only checkout shipping options.
   */
  shippingProviders: MerchantCarrierProviderId[];
  /**
   * The merchant's `payout_currency`, returned by the SECURITY DEFINER RPC for
   * the requested merchant. Lets the quote path resolve the canonical currency
   * (via `resolveMerchantCurrencyConfig`) for the stale-currency filter without
   * the route reading the `merchants` table for an arbitrary body id. Optional:
   * absent when the RPC predates the currency columns (backward-compat).
   */
  merchantPayoutCurrency?: string | null;
  /**
   * The merchant's ISO `country`, returned by the same RPC. Paired with
   * `merchantPayoutCurrency` to resolve the canonical currency. Optional for the
   * same backward-compat reason.
   */
  merchantCountry?: string | null;
}
