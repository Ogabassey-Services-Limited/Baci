import { describe, expect, it } from 'vitest';
import {
  computedRatesToShippingQuotes,
  MERCHANT_RATE_QUOTE_TTL_MS,
} from './to-shipping-quotes';
import type { ComputedMerchantRate, MerchantShippingRate } from './types';

function rate(
  overrides: Partial<MerchantShippingRate> = {}
): MerchantShippingRate {
  return {
    id: 'rate-1',
    zoneId: 'z-1',
    name: 'Standard Delivery',
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

function computed(
  rateOverrides: Partial<MerchantShippingRate> = {},
  amount = 1500,
  isFree = false
): ComputedMerchantRate {
  return { rate: rate(rateOverrides), amount, isFree };
}

const NOW = 1_700_000_000_000;

describe('computedRatesToShippingQuotes', () => {
  it('maps a ship rate onto the ShippingQuote shape', () => {
    const [quote] = computedRatesToShippingQuotes([computed()], { now: NOW });

    expect(quote).toMatchObject({
      id: 'mrate_rate-1',
      provider: 'MERCHANT',
      carrierName: 'Standard Delivery',
      displayName: 'Standard Delivery',
      price: 1500,
      currency: 'NGN',
      isStationPickup: false,
      pickupIncluded: false,
      insuranceIncluded: false,
    });
  });

  it('uses the computed amount as the price for free rates', () => {
    const [quote] = computedRatesToShippingQuotes(
      [computed({ freeOverAmount: 500 }, 0, true)],
      { now: NOW }
    );

    expect(quote.price).toBe(0);
  });

  it('carries the merchant currency through', () => {
    const [quote] = computedRatesToShippingQuotes(
      [computed({ currency: 'INR' })],
      { now: NOW }
    );

    expect(quote.currency).toBe('INR');
  });

  it('derives estimatedDays from the midpoint of a day range', () => {
    const [quote] = computedRatesToShippingQuotes(
      [computed({ deliveryMinDays: 2, deliveryMaxDays: 4 })],
      { now: NOW }
    );

    expect(quote).toMatchObject({
      estimatedDays: 3,
      minDays: 2,
      maxDays: 4,
      deliveryRange: '2-4 days',
    });
  });

  it('emits a zero estimatedDays sentinel and no range when days are unset', () => {
    const [quote] = computedRatesToShippingQuotes([computed()], { now: NOW });

    expect(quote.estimatedDays).toBe(0);
    expect(quote.deliveryRange).toBeUndefined();
    expect(quote.minDays).toBeUndefined();
    expect(quote.maxDays).toBeUndefined();
  });

  it('maps a pickup rate to a station pickup quote with address', () => {
    const [quote] = computedRatesToShippingQuotes(
      [
        computed(
          {
            kind: 'pickup',
            name: 'Store pickup',
            pickupAddress: {
              label: 'Main Store',
              address: '12 Adeola Odeku',
              city: 'Victoria Island',
              state: 'Lagos',
            },
          },
          0,
          false
        ),
      ],
      { now: NOW }
    );

    expect(quote).toMatchObject({
      isStationPickup: true,
      stationName: 'Main Store',
      stationAddress: '12 Adeola Odeku, Victoria Island, Lagos',
    });
  });

  it('falls back to the rate name when a pickup has no label', () => {
    const [quote] = computedRatesToShippingQuotes(
      [computed({ kind: 'pickup', name: 'Store pickup', pickupAddress: null })],
      { now: NOW }
    );

    expect(quote.stationName).toBe('Store pickup');
    expect(quote.stationAddress).toBeUndefined();
  });

  it('exposes pickup collection instructions on the quote', () => {
    const [quote] = computedRatesToShippingQuotes(
      [
        computed(
          {
            kind: 'pickup',
            name: 'Store pickup',
            pickupAddress: {
              label: 'Main Store',
              address: '12 Adeola Odeku',
              instructions: '  Ring the bell twice and ask for Ada  ',
            },
          },
          0,
          false
        ),
      ],
      { now: NOW }
    );

    expect(quote.stationInstructions).toBe(
      'Ring the bell twice and ask for Ada'
    );
  });

  it('omits stationInstructions when a pickup has none', () => {
    const [quote] = computedRatesToShippingQuotes(
      [
        computed(
          {
            kind: 'pickup',
            name: 'Store pickup',
            pickupAddress: { label: 'Main Store', address: '12 Adeola Odeku' },
          },
          0,
          false
        ),
      ],
      { now: NOW }
    );

    expect(quote.stationInstructions).toBeUndefined();
  });

  it('never sets stationInstructions on a ship rate', () => {
    const [quote] = computedRatesToShippingQuotes([computed()], { now: NOW });

    expect(quote.stationInstructions).toBeUndefined();
  });

  it('stamps a far-future expiry so rates never expire mid-checkout', () => {
    const [quote] = computedRatesToShippingQuotes([computed()], { now: NOW });

    expect(quote.expiresAt.getTime()).toBe(NOW + MERCHANT_RATE_QUOTE_TTL_MS);
  });

  it('returns an empty array for no computed rates', () => {
    expect(computedRatesToShippingQuotes([], { now: NOW })).toEqual([]);
  });
});
