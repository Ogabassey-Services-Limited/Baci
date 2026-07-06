import { describe, expect, it, vi } from 'vitest';
import type { QuoteRequest, ShipmentItem, ShippingAddress } from '../types';
import { PickupOptions } from './gigl.constants';
import {
  buildCountryLookupUrl,
  buildInternationalItems,
  buildInternationalPackages,
  estimatedDays,
  internationalRateId,
  internationalServiceTier,
  isNigeriaAddress,
  matchDestinationCountry,
  parseInternationalRateId,
  totalDeclaredValue,
} from './gigl.international-payload';

const receiver: ShippingAddress = {
  name: 'Jane Receiver',
  phone: '+14165550123',
  address: '123 Queen Street West',
  city: 'Toronto',
  state: 'Ontario',
  country: 'Canada',
  countryCode: 'CA',
};

describe('GIGL international payload helpers', () => {
  it('carries dimensions into non-document item and package payloads', () => {
    const item: ShipmentItem & {
      height: number;
      length: number;
      width: number;
    } = {
      name: 'Phone',
      quantity: 2,
      weight: 1,
      value: 100_000,
      hsCode: '851712',
      length: 10,
      width: 8,
      height: 6,
    };

    expect(buildInternationalItems([item])[0]).toMatchObject({
      HSCode: '851712',
      IsVolumetric: true,
      Length: 10,
      Width: 8,
      Height: 6,
    });
    expect(buildInternationalPackages([item])).toEqual([
      { Weight: 1, Length: 10, Width: 8, Height: 6 },
      { Weight: 1, Length: 10, Width: 8, Height: 6 },
    ]);
  });

  it('omits package payloads when dimensions are incomplete', () => {
    const item: ShipmentItem = {
      name: 'Phone',
      quantity: 1,
      weight: 1,
      value: 100_000,
    };

    expect(buildInternationalItems([item])[0]).toMatchObject({
      IsVolumetric: false,
    });
    expect(buildInternationalPackages([item])).toEqual([]);
  });

  it('rejects invalid dimensional package quantities', () => {
    const item: ShipmentItem & {
      height: number;
      length: number;
      width: number;
    } = {
      name: 'Phone',
      quantity: 1,
      weight: 1,
      value: 100_000,
      length: 10,
      width: 8,
      height: 6,
    };

    expect(() =>
      buildInternationalPackages([{ ...item, quantity: 0 }])
    ).toThrow('Invalid package quantity for GIGL international item');
    expect(() =>
      buildInternationalPackages([{ ...item, quantity: 101 }])
    ).toThrow('Too many packages for one GIGL international item');
  });

  it('caps total dimensional packages before expansion', () => {
    const item: ShipmentItem & {
      height: number;
      length: number;
      width: number;
    } = {
      name: 'Phone',
      quantity: 100,
      weight: 1,
      value: 100_000,
      length: 10,
      width: 8,
      height: 6,
    };

    expect(() =>
      buildInternationalPackages(Array.from({ length: 6 }, () => item))
    ).toThrow('Too many packages for GIGL international shipment');
  });

  it('matches countries by short code, code, or name', () => {
    const country = matchDestinationCountry(receiver, [
      {
        CountryId: 36,
        CountryName: 'Canada',
        CountryCode: 'CANADA',
        CountryShortCode: 'CA',
        IsInternationalShippingCountry: true,
      },
    ]);

    expect(country?.CountryId).toBe(36);
    expect(buildCountryLookupUrl('https://example.test', receiver)).toBe(
      'https://example.test/country/get?CountryName=Canada'
    );
  });

  it('requires countries to be explicitly eligible for international shipping', () => {
    expect(
      matchDestinationCountry(receiver, [
        {
          CountryId: 36,
          CountryName: 'Canada',
          CountryShortCode: 'CA',
        },
      ])
    ).toBeUndefined();
    expect(
      matchDestinationCountry(receiver, [
        {
          CountryId: 36,
          CountryName: 'Canada',
          CountryShortCode: 'CA',
          IsInternationalShippingCountry: false,
        },
      ])
    ).toBeUndefined();
  });

  it('round-trips international rate IDs and rejects malformed IDs', () => {
    const rateId = internationalRateId({
      deliveryType: 2,
      logisticsCompany: 0,
      shipmentMethod: 0,
      pickupOption: PickupOptions.ServiceCentre,
    });

    expect(parseInternationalRateId(rateId)).toEqual({
      deliveryType: 2,
      logisticsCompany: 0,
      shipmentMethod: 0,
      pickupOption: PickupOptions.ServiceCentre,
    });
    expect(() => parseInternationalRateId('GIGL_INTL_2_BAD_0_1')).toThrow(
      'Invalid GIGL international rate selection'
    );
    expect(() => parseInternationalRateId('GIGL_INTL_2_0_0_1_9')).toThrow(
      'Invalid GIGL international rate selection'
    );
    expect(() => parseInternationalRateId('GIGL_INTL_2.5_0_0_1')).toThrow(
      'Invalid GIGL international rate selection'
    );
  });

  it('detects Nigeria addresses by country code or name', () => {
    expect(
      isNigeriaAddress({ ...receiver, country: 'Canada', countryCode: 'NG' })
    ).toBe(true);
    expect(
      isNigeriaAddress({ ...receiver, country: 'Canada', countryCode: 'NGA' })
    ).toBe(true);
    expect(
      isNigeriaAddress({
        ...receiver,
        country: 'Nigeria',
        countryCode: 'CA',
      })
    ).toBe(true);
    expect(isNigeriaAddress(receiver)).toBe(false);
  });

  it('derives declared value and service metadata', () => {
    const request: Pick<QuoteRequest, 'items'> = {
      items: [
        { name: 'Phone', quantity: 2, weight: 1, value: 100_000 },
        { name: 'Case', quantity: 1, weight: 0.2, value: 10_000 },
      ],
    };

    expect(totalDeclaredValue(request)).toBe(210_000);
    expect(internationalServiceTier(2)).toBe('International Express');
    expect(internationalServiceTier(1)).toBe('International Standard');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'));
    try {
      expect(estimatedDays('2026-07-07T00:00:00.000Z')).toBe(3);
      expect(estimatedDays('not-a-date')).toBe(7);
      expect(estimatedDays('2026-07-03T00:00:00.000Z')).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
