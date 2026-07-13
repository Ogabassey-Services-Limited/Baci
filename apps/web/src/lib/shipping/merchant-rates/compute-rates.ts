/**
 * Fee computation for merchant-configured shipping rates.
 *
 * Given the winning zone and the canonical server-verified subtotal, resolve
 * which rates apply and what each costs:
 *   - active rates scoped to the zone
 *   - `price_tier` rates apply only when `minSubtotal <= subtotal < maxSubtotal`
 *     (lower bound inclusive, upper bound exclusive; `null` bound = unbounded)
 *   - `free_over_amount`: when `subtotal >= free_over_amount` the fee is 0
 *
 * Results are ordered by `sortOrder` (ascending), then `amount` (ascending) to
 * give the checkout a stable, cheapest-friendly list.
 */

import type { ComputedMerchantRate, MerchantShippingRate } from './types';

export interface ComputeMerchantRatesInput {
  /** The zone selected by `matchShippingZone`. */
  zoneId: string;
  /**
   * Canonical, server-verified pre-discount subtotal used for both tier bounds
   * and the free-over-threshold check.
   */
  subtotal: number;
}

/** Whether a rate's `price_tier` condition includes `subtotal`. */
function isWithinTier(rate: MerchantShippingRate, subtotal: number): boolean {
  if (rate.conditionType !== 'price_tier') {
    return true;
  }
  if (rate.minSubtotal !== null && subtotal < rate.minSubtotal) {
    return false;
  }
  if (rate.maxSubtotal !== null && subtotal >= rate.maxSubtotal) {
    return false;
  }
  return true;
}

/** Resolve the final fee for a rate, applying the free-over-threshold. */
function resolveAmount(
  rate: MerchantShippingRate,
  subtotal: number
): { amount: number; isFree: boolean } {
  if (rate.freeOverAmount !== null && subtotal >= rate.freeOverAmount) {
    return { amount: 0, isFree: true };
  }
  return { amount: rate.baseAmount, isFree: false };
}

/**
 * Compute the applicable merchant rates for a zone and subtotal. Never throws;
 * returns an empty list when nothing applies.
 */
export function computeMerchantRates(
  rates: MerchantShippingRate[],
  input: ComputeMerchantRatesInput
): ComputedMerchantRate[] {
  const applicable: ComputedMerchantRate[] = [];

  for (const rate of rates) {
    if (!rate.active || rate.zoneId !== input.zoneId) {
      continue;
    }
    if (!isWithinTier(rate, input.subtotal)) {
      continue;
    }

    const { amount, isFree } = resolveAmount(rate, input.subtotal);
    applicable.push({ rate, amount, isFree });
  }

  return applicable.sort((a, b) => {
    if (a.rate.sortOrder !== b.rate.sortOrder) {
      return a.rate.sortOrder - b.rate.sortOrder;
    }
    return a.amount - b.amount;
  });
}
