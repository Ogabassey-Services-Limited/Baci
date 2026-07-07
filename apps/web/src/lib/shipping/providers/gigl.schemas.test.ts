import { describe, expect, it } from 'vitest';
import { giglSchemas } from './gigl.schemas';

describe('giglSchemas', () => {
  it('accepts partial tracking shipments with nullable status reasons', () => {
    const data = giglSchemas.trackingData.parse([
      {
        Waybill: 'GIGL123',
        PickupOptions: 1,
        MobileShipmentTrackings: [
          {
            Status: 'Shipment delivered',
            ScanStatusReason: null,
            DateTime: '2026-06-27T08:00:00.000Z',
          },
        ],
      },
    ]);

    expect(data[0].Origin).toBeUndefined();
    expect(data[0].Destination).toBeUndefined();
    expect(data[0].DeliveryType).toBeUndefined();
    expect(data[0].MobileShipmentTrackings[0].ScanStatusReason).toBe('');
  });

  it('rejects malformed price totals', () => {
    const result = giglSchemas.priceData.safeParse({
      GrandTotal: '8941.43',
    });

    expect(result.success).toBe(false);
  });

  it('validates GIGL country payloads', () => {
    expect(
      giglSchemas.countryData.safeParse([
        {
          CountryId: 36,
          CountryName: 'Canada',
          CountryCode: 'CANADA',
          CountryShortCode: 'CA',
          IsInternationalShippingCountry: true,
        },
      ]).success
    ).toBe(true);
    expect(
      giglSchemas.countryData.safeParse([
        {
          CountryName: 'Canada',
        },
      ]).success
    ).toBe(false);
  });

  it('validates international price rates', () => {
    expect(
      giglSchemas.internationalPriceData.safeParse([
        {
          GrandTotal: 114_534.49,
          LogisticCompany: 0,
          ShipmentMethod: 0,
          DeliveryType: 2,
        },
      ]).success
    ).toBe(true);
    expect(
      giglSchemas.internationalPriceData.safeParse([
        {
          GrandTotal: 0,
          LogisticCompany: 0,
          ShipmentMethod: 0,
          DeliveryType: 2,
        },
      ]).success
    ).toBe(false);
  });

  it('rejects empty international booking payloads', () => {
    const result = giglSchemas.internationalBookingData.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects blank international booking identifiers', () => {
    const result = giglSchemas.internationalBookingData.safeParse({
      Waybill: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('requires an invoice label when an invoice payload is parsed', () => {
    expect(
      giglSchemas.invoiceData.safeParse({
        WaybillLabel: 'https://example.test/label.pdf',
      }).success
    ).toBe(true);
    expect(giglSchemas.invoiceData.safeParse({}).success).toBe(false);
  });
});
