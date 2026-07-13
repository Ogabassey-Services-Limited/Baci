/**
 * Dashboard-facing shapes for merchant shipping zones/rates — the camelCase
 * view `actions.ts` returns to the client after mapping DB rows. Distinct
 * from `@/lib/shipping/merchant-rates/types` (the checkout-safe subset the
 * storefront RPC returns): the dashboard also needs `active` on zones and
 * every rate regardless of active state, which the RPC deliberately omits.
 *
 * Pure type file — no runtime logic (coverage exemption per repo conventions).
 */

import type {
  MerchantPickupAddress,
  MerchantRateConditionType,
  MerchantRateKind,
} from '@/lib/shipping/merchant-rates/types';

export interface ShippingZoneLocation {
  countryCode: string;
  /** `null` = the whole country. */
  subdivisionCode: string | null;
}

export interface ShippingZone {
  id: string;
  name: string;
  isRestOfWorld: boolean;
  active: boolean;
  locations: ShippingZoneLocation[];
}

export interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  kind: MerchantRateKind;
  currency: string;
  baseAmount: number;
  conditionType: MerchantRateConditionType;
  minSubtotal: number | null;
  maxSubtotal: number | null;
  freeOverAmount: number | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  pickupAddress: MerchantPickupAddress | null;
  sortOrder: number;
  active: boolean;
}

export interface ShippingConfig {
  zones: ShippingZone[];
  rates: ShippingRate[];
  /** The merchant's resolved ISO 4217 code — rates are always stamped with this. */
  currencyCode: string;
  currencySymbol: string;
}
