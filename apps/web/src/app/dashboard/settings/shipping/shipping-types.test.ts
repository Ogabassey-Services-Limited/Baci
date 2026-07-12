/**
 * Pure type file — no runtime logic. Per repo conventions this is a
 * type-level compile assertion (`expectTypeOf`), not a behavioral test.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ShippingConfig,
  ShippingRate,
  ShippingZone,
  ShippingZoneLocation,
} from './shipping-types';

describe('shipping-types', () => {
  it('ShippingZoneLocation allows a nullable subdivisionCode', () => {
    const wholeCountry: ShippingZoneLocation = {
      countryCode: 'NG',
      subdivisionCode: null,
    };
    const subdivision: ShippingZoneLocation = {
      countryCode: 'NG',
      subdivisionCode: 'NG-LA',
    };

    expectTypeOf(wholeCountry).toMatchTypeOf<ShippingZoneLocation>();
    expectTypeOf(subdivision).toMatchTypeOf<ShippingZoneLocation>();
    expectTypeOf(wholeCountry.subdivisionCode).toEqualTypeOf<string | null>();
  });

  it('ShippingZone carries active state and a locations array', () => {
    const zone: ShippingZone = {
      id: 'z-1',
      name: 'Lagos',
      isRestOfWorld: false,
      active: true,
      locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
    };

    expectTypeOf(zone).toMatchTypeOf<ShippingZone>();
    expectTypeOf(zone.locations).toEqualTypeOf<ShippingZoneLocation[]>();
    expectTypeOf(zone.isRestOfWorld).toEqualTypeOf<boolean>();
  });

  it('ShippingRate models the kind/condition unions and nullable numeric fields', () => {
    const rate: ShippingRate = {
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
    };

    expectTypeOf(rate).toMatchTypeOf<ShippingRate>();
    expectTypeOf(rate.kind).toEqualTypeOf<'ship' | 'pickup'>();
    expectTypeOf(rate.conditionType).toEqualTypeOf<'always' | 'price_tier'>();
    expectTypeOf(rate.minSubtotal).toEqualTypeOf<number | null>();
  });

  it('ShippingConfig bundles zones, rates, and the resolved currency', () => {
    const config: ShippingConfig = {
      zones: [],
      rates: [],
      currencyCode: 'NGN',
      currencySymbol: '₦',
    };

    expectTypeOf(config).toMatchTypeOf<ShippingConfig>();
    expectTypeOf(config.zones).toEqualTypeOf<ShippingZone[]>();
    expectTypeOf(config.rates).toEqualTypeOf<ShippingRate[]>();
  });
});
