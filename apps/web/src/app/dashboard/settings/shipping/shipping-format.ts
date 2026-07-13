/**
 * Pure display-formatting helpers for the shipping dashboard client
 * components. Split out from the components themselves so the formatting
 * logic has its own colocated test file.
 */

import { getCountryByCode } from '@/lib/countries';
import { getSubdivisions } from '@/lib/shipping/merchant-rates/subdivisions';
import type { ShippingRate, ShippingZoneLocation } from './shipping-types';

/** "Lagos, Nigeria" for a subdivision entry, else "Nigeria" for a whole-country entry. */
export function formatLocationLabel(location: ShippingZoneLocation): string {
  const country = getCountryByCode(location.countryCode);
  const countryName = country?.name ?? location.countryCode;

  if (!location.subdivisionCode) {
    return countryName;
  }

  const subdivision = getSubdivisions(location.countryCode).find(
    (candidate) => candidate.code === location.subdivisionCode
  );
  return subdivision ? `${subdivision.name}, ${countryName}` : countryName;
}

/** Group rates by their owning zone id, preserving each rate array's incoming order. */
export function groupRatesByZone(
  rates: ShippingRate[]
): Map<string, ShippingRate[]> {
  const byZone = new Map<string, ShippingRate[]>();
  for (const rate of rates) {
    const existing = byZone.get(rate.zoneId);
    if (existing) {
      existing.push(rate);
    } else {
      byZone.set(rate.zoneId, [rate]);
    }
  }
  return byZone;
}

/** "2–4 days" / "2 days" / null when neither bound is set. */
export function formatDeliveryEstimate(rate: ShippingRate): string | null {
  const { deliveryMinDays: min, deliveryMaxDays: max } = rate;
  if (min === null && max === null) {
    return null;
  }
  if (min !== null && max !== null && min !== max) {
    return `${min}–${max} days`;
  }
  const single = min ?? max;
  return `${single} day${single === 1 ? '' : 's'}`;
}

/** A one-line summary of when a rate applies, e.g. "Always applies" or a tier range. */
export function summarizeRateCondition(
  rate: ShippingRate,
  formatAmount: (amount: number) => string
): string {
  if (rate.conditionType !== 'price_tier') {
    return 'Always applies';
  }
  const { minSubtotal, maxSubtotal } = rate;
  if (minSubtotal !== null && maxSubtotal !== null) {
    return `Orders ${formatAmount(minSubtotal)}–${formatAmount(maxSubtotal)}`;
  }
  if (minSubtotal !== null) {
    return `Orders over ${formatAmount(minSubtotal)}`;
  }
  if (maxSubtotal !== null) {
    return `Orders under ${formatAmount(maxSubtotal)}`;
  }
  return 'Always applies';
}
