import { describe, expect, it } from 'vitest';
import {
  formatDeliveryEstimate,
  formatLocationLabel,
  groupRatesByZone,
  summarizeRateCondition,
} from './shipping-format';
import type { ShippingRate } from './shipping-types';

describe('formatLocationLabel', () => {
  it('formats a whole-country location', () => {
    expect(
      formatLocationLabel({ countryCode: 'NG', subdivisionCode: null })
    ).toBe('Nigeria');
  });

  it('formats a subdivision location with its country', () => {
    expect(
      formatLocationLabel({ countryCode: 'NG', subdivisionCode: 'NG-LA' })
    ).toBe('Lagos, Nigeria');
  });

  it('falls back to the raw code for an unknown country', () => {
    expect(
      formatLocationLabel({ countryCode: 'ZZ', subdivisionCode: null })
    ).toBe('ZZ');
  });

  it('falls back to the country name when the subdivision code is unrecognized', () => {
    expect(
      formatLocationLabel({ countryCode: 'NG', subdivisionCode: 'NG-XX' })
    ).toBe('Nigeria');
  });
});

function makeRate(overrides: Partial<ShippingRate>): ShippingRate {
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

describe('groupRatesByZone', () => {
  it('groups rates under their zone id, preserving order', () => {
    const rates = [
      makeRate({ id: 'r-1', zoneId: 'z-1' }),
      makeRate({ id: 'r-2', zoneId: 'z-2' }),
      makeRate({ id: 'r-3', zoneId: 'z-1' }),
    ];

    const result = groupRatesByZone(rates);

    expect(result.get('z-1')?.map((r) => r.id)).toEqual(['r-1', 'r-3']);
    expect(result.get('z-2')?.map((r) => r.id)).toEqual(['r-2']);
  });
});

describe('formatDeliveryEstimate', () => {
  it('returns null when neither bound is set', () => {
    expect(formatDeliveryEstimate(makeRate({}))).toBeNull();
  });

  it('formats a range', () => {
    expect(
      formatDeliveryEstimate(
        makeRate({ deliveryMinDays: 2, deliveryMaxDays: 4 })
      )
    ).toBe('2–4 days');
  });

  it('formats a single day', () => {
    expect(
      formatDeliveryEstimate(
        makeRate({ deliveryMinDays: 1, deliveryMaxDays: 1 })
      )
    ).toBe('1 day');
  });

  it('formats a single multi-day value when only one bound is set', () => {
    expect(formatDeliveryEstimate(makeRate({ deliveryMinDays: 3 }))).toBe(
      '3 days'
    );
  });
});

describe('summarizeRateCondition', () => {
  const formatAmount = (amount: number) => `₦${amount.toLocaleString()}`;

  it('summarizes an always-on rate', () => {
    expect(summarizeRateCondition(makeRate({}), formatAmount)).toBe(
      'Always applies'
    );
  });

  it('summarizes a bounded tier', () => {
    const rate = makeRate({
      conditionType: 'price_tier',
      minSubtotal: 0,
      maxSubtotal: 50_000,
    });
    expect(summarizeRateCondition(rate, formatAmount)).toBe(
      'Orders ₦0–₦50,000'
    );
  });

  it('summarizes a lower-bound-only tier', () => {
    const rate = makeRate({ conditionType: 'price_tier', minSubtotal: 50_000 });
    expect(summarizeRateCondition(rate, formatAmount)).toBe(
      'Orders over ₦50,000'
    );
  });

  it('summarizes an upper-bound-only tier', () => {
    const rate = makeRate({ conditionType: 'price_tier', maxSubtotal: 50_000 });
    expect(summarizeRateCondition(rate, formatAmount)).toBe(
      'Orders under ₦50,000'
    );
  });
});
