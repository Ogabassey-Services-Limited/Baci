import { describe, expect, it } from 'vitest';
import {
  MERCHANT_SHIPPING_CONDITION_TYPES,
  MERCHANT_SHIPPING_RATE_KINDS,
  parseStorefrontShippingRatesPayload,
  storefrontShippingRatesPayloadSchema,
} from './merchant-shipping-rates';

const validPayload = {
  zones: [
    { id: 'z-1', name: 'Lagos', is_rest_of_world: false, active: true },
    {
      id: 'z-row',
      name: 'Rest of world',
      is_rest_of_world: true,
      active: true,
    },
  ],
  locations: [
    { zone_id: 'z-1', country_code: 'NG', subdivision_code: 'NG-LA' },
    { zone_id: 'z-1', country_code: 'NG', subdivision_code: null },
  ],
  rates: [
    {
      id: 'r-1',
      zone_id: 'z-1',
      name: 'Standard',
      kind: 'ship',
      currency: 'ngn',
      base_amount: '1500.00',
      condition_type: 'price_tier',
      min_subtotal: '0',
      max_subtotal: null,
      free_over_amount: '50000',
      delivery_min_days: '2',
      delivery_max_days: '4',
      pickup_address: null,
      sort_order: '1',
      active: true,
    },
  ],
};

describe('storefrontShippingRatesPayloadSchema', () => {
  it('normalizes a snake_case payload into camelCase engine types', () => {
    const result = storefrontShippingRatesPayloadSchema.parse(validPayload);

    expect(result.zones[0]).toEqual({
      id: 'z-1',
      name: 'Lagos',
      isRestOfWorld: false,
      active: true,
    });
    expect(result.locations[1]).toEqual({
      zoneId: 'z-1',
      countryCode: 'NG',
      subdivisionCode: null,
    });
  });

  it('coerces string numerics and uppercases currency', () => {
    const { rates } = storefrontShippingRatesPayloadSchema.parse(validPayload);

    expect(rates[0]).toMatchObject({
      currency: 'NGN',
      baseAmount: 1500,
      minSubtotal: 0,
      maxSubtotal: null,
      freeOverAmount: 50000,
      deliveryMinDays: 2,
      deliveryMaxDays: 4,
      sortOrder: 1,
    });
  });

  it('maps a pickup_address country_code alias to countryCode', () => {
    const result = storefrontShippingRatesPayloadSchema.parse({
      ...validPayload,
      rates: [
        {
          ...validPayload.rates[0],
          kind: 'pickup',
          pickup_address: {
            label: 'Main Store',
            address: '12 Adeola Odeku',
            country_code: 'NG',
          },
        },
      ],
    });

    expect(result.rates[0].pickupAddress).toEqual({
      label: 'Main Store',
      address: '12 Adeola Odeku',
      countryCode: 'NG',
    });
  });

  it('drops malformed rows but keeps valid ones', () => {
    const result = storefrontShippingRatesPayloadSchema.parse({
      zones: [
        { id: '', name: 'bad zone' }, // empty id -> dropped
        { id: 'z-ok', name: 'Good', is_rest_of_world: false, active: true },
      ],
      locations: [],
      rates: [
        { ...validPayload.rates[0], currency: 'INVALID' }, // bad currency -> dropped
        { ...validPayload.rates[0], id: 'r-ok' },
      ],
    });

    expect(result.zones.map((z) => z.id)).toEqual(['z-ok']);
    expect(result.rates.map((r) => r.id)).toEqual(['r-ok']);
  });

  it('defaults missing top-level keys to empty arrays', () => {
    const result = storefrontShippingRatesPayloadSchema.parse({});

    expect(result).toEqual({
      zones: [],
      locations: [],
      rates: [],
      shippingProviders: [],
    });
  });

  it('normalizes supported provider ids and drops malformed stored values', () => {
    const result = storefrontShippingRatesPayloadSchema.parse({
      ...validPayload,
      shipping_providers: [
        ' GIGL ',
        'topship',
        'TopShip',
        'shiip',
        'SHIIP',
        'future-carrier',
        42,
        'gigl',
      ],
    });

    expect(result.shippingProviders).toEqual(['gigl', 'topship']);
  });

  it('treats a non-array legacy provider value as no carrier opt-in', () => {
    const result = storefrontShippingRatesPayloadSchema.parse({
      ...validPayload,
      shipping_providers: 'gigl',
    });

    expect(result.shippingProviders).toEqual([]);
  });

  it('surfaces merchant payout currency and country when the RPC returns them', () => {
    const result = storefrontShippingRatesPayloadSchema.parse({
      ...validPayload,
      merchant_payout_currency: 'inr',
      merchant_country: 'in',
    });

    // Passed through untrimmed-of-case (resolver normalizes casing downstream).
    expect(result.merchantPayoutCurrency).toBe('inr');
    expect(result.merchantCountry).toBe('in');
  });

  it('omits merchant currency fields for blank / non-string RPC values', () => {
    const result = storefrontShippingRatesPayloadSchema.parse({
      ...validPayload,
      merchant_payout_currency: '   ',
      merchant_country: 42,
    });

    expect(result.merchantPayoutCurrency).toBeUndefined();
    expect(result.merchantCountry).toBeUndefined();
  });
});

describe('parseStorefrontShippingRatesPayload', () => {
  it('returns an empty payload for null / invalid input instead of throwing', () => {
    expect(parseStorefrontShippingRatesPayload(null)).toEqual({
      zones: [],
      locations: [],
      rates: [],
      shippingProviders: [],
    });
    expect(parseStorefrontShippingRatesPayload('not an object')).toEqual({
      zones: [],
      locations: [],
      rates: [],
      shippingProviders: [],
    });
  });

  it('parses a valid payload', () => {
    const result = parseStorefrontShippingRatesPayload(validPayload);

    expect(result.rates).toHaveLength(1);
  });
});

describe('runtime enum tuples', () => {
  it('stay in sync with the DB check constraints', () => {
    expect(MERCHANT_SHIPPING_RATE_KINDS).toEqual(['ship', 'pickup']);
    expect(MERCHANT_SHIPPING_CONDITION_TYPES).toEqual(['always', 'price_tier']);
  });
});
