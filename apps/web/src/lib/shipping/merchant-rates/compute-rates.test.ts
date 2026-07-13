import { describe, expect, it } from 'vitest';
import { computeMerchantRates } from './compute-rates';
import type { MerchantShippingRate } from './types';

function rate(
  overrides: Partial<MerchantShippingRate> = {}
): MerchantShippingRate {
  return {
    id: 'r-1',
    zoneId: 'z-1',
    name: 'Standard',
    kind: 'ship',
    currency: 'NGN',
    baseAmount: 1500,
    conditionType: 'always',
    minSubtotal: null,
    maxSubtotal: null,
    freeOverAmount: null,
    deliveryMinDays: null,
    deliveryMaxDays: null,
    pickupAddress: null,
    sortOrder: 0,
    active: true,
    ...overrides,
  };
}

describe('computeMerchantRates', () => {
  it('returns an always-on rate scoped to the zone', () => {
    const result = computeMerchantRates([rate()], {
      zoneId: 'z-1',
      subtotal: 5000,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ amount: 1500, isFree: false });
  });

  it('excludes inactive rates and rates for other zones', () => {
    const rates = [
      rate({ id: 'r-inactive', active: false }),
      rate({ id: 'r-other-zone', zoneId: 'z-2' }),
      rate({ id: 'r-ok' }),
    ];

    const result = computeMerchantRates(rates, {
      zoneId: 'z-1',
      subtotal: 100,
    });

    expect(result.map((entry) => entry.rate.id)).toEqual(['r-ok']);
  });

  it('includes a price tier at its inclusive minimum bound', () => {
    const tierRate = rate({
      conditionType: 'price_tier',
      minSubtotal: 100,
      maxSubtotal: 200,
    });

    const result = computeMerchantRates([tierRate], {
      zoneId: 'z-1',
      subtotal: 100,
    });

    expect(result).toHaveLength(1);
  });

  it('excludes a price tier at its exclusive maximum bound', () => {
    const tierRate = rate({
      conditionType: 'price_tier',
      minSubtotal: 100,
      maxSubtotal: 200,
    });

    const result = computeMerchantRates([tierRate], {
      zoneId: 'z-1',
      subtotal: 200,
    });

    expect(result).toHaveLength(0);
  });

  it('excludes a price tier below its minimum bound', () => {
    const tierRate = rate({
      conditionType: 'price_tier',
      minSubtotal: 100,
      maxSubtotal: 200,
    });

    const result = computeMerchantRates([tierRate], {
      zoneId: 'z-1',
      subtotal: 99,
    });

    expect(result).toHaveLength(0);
  });

  it('makes a rate free at the exact free-over threshold', () => {
    const freeOverRate = rate({ baseAmount: 2000, freeOverAmount: 500 });

    const result = computeMerchantRates([freeOverRate], {
      zoneId: 'z-1',
      subtotal: 500,
    });

    expect(result[0]).toMatchObject({ amount: 0, isFree: true });
  });

  it('charges the base amount just below the free-over threshold', () => {
    const freeOverRate = rate({ baseAmount: 2000, freeOverAmount: 500 });

    const result = computeMerchantRates([freeOverRate], {
      zoneId: 'z-1',
      subtotal: 499,
    });

    expect(result[0]).toMatchObject({ amount: 2000, isFree: false });
  });

  it('orders by sortOrder then amount', () => {
    const rates = [
      rate({ id: 'r-late-cheap', sortOrder: 1, baseAmount: 100 }),
      rate({ id: 'r-early-expensive', sortOrder: 0, baseAmount: 900 }),
      rate({ id: 'r-early-cheap', sortOrder: 0, baseAmount: 300 }),
    ];

    const result = computeMerchantRates(rates, { zoneId: 'z-1', subtotal: 0 });

    expect(result.map((entry) => entry.rate.id)).toEqual([
      'r-early-cheap',
      'r-early-expensive',
      'r-late-cheap',
    ]);
  });

  it('returns an empty list when no rates apply', () => {
    expect(computeMerchantRates([], { zoneId: 'z-1', subtotal: 100 })).toEqual(
      []
    );
  });
});
