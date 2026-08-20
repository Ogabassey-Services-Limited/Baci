import { describe, expect, it } from 'vitest';
import {
  buildReceiver,
  deriveMerchantLocation,
  parseStoredQuoteRequest,
  selectPreferredQuote,
  toShipmentItems,
} from './order-shipment-booking-utils';

describe('order-shipment-booking-utils', () => {
  it('parses a stored quote request payload', () => {
    const result = parseStoredQuoteRequest({
      sessionId: 'session-1',
      shipmentType: 'domestic',
      deliveryPreference: 'pickup_station',
      receiver: {
        name: 'Jane Doe',
        phone: '08000000000',
        address: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      sender: {
        name: 'Store',
        phone: '08000000001',
        address: '1 Merchant Road',
        city: 'Yaba',
        state: 'Lagos',
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 500000 }],
    });

    expect(result).toEqual({
      sessionId: 'session-1',
      shipmentType: 'domestic',
      deliveryPreference: 'pickup_station',
      receiver: {
        name: 'Jane Doe',
        phone: '08000000000',
        address: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 500000 }],
      sender: {
        name: 'Store',
        phone: '08000000001',
        address: '1 Merchant Road',
        city: 'Yaba',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
    });
  });

  it('selects the closest refreshed quote to the original quote', () => {
    const selected = selectPreferredQuote(
      [
        {
          id: 'quote-1',
          provider: 'TOPSHIP',
          serviceTier: 'Express',
          carrierName: 'Topship',
          displayName: 'Topship - Express',
          estimatedDays: 2,
          price: 6500,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          expiresAt: new Date('2026-03-23T10:00:00Z'),
        },
        {
          id: 'quote-2',
          provider: 'TOPSHIP',
          serviceTier: 'Budget',
          carrierName: 'Topship',
          displayName: 'Topship - Budget',
          estimatedDays: 4,
          price: 4500,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          expiresAt: new Date('2026-03-23T10:00:00Z'),
        },
      ],
      { serviceTier: 'Budget', carrierName: 'Topship' }
    );

    expect(selected?.id).toBe('quote-2');
  });

  it('matches refreshed quotes by provider rate id before tier and carrier', () => {
    const selected = selectPreferredQuote(
      [
        {
          id: 'quote-1',
          provider: 'GIGL',
          serviceTier: 'International Express',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics - International Express',
          estimatedDays: 5,
          price: 120000,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          providerRateId: 'GIGL_INTL_2_0_0_1',
          expiresAt: new Date('2026-03-23T10:00:00Z'),
        },
        {
          id: 'quote-2',
          provider: 'GIGL',
          serviceTier: 'International Express',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics - International Express',
          estimatedDays: 5,
          price: 150000,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          providerRateId: 'GIGL_INTL_2_1_3_1',
          expiresAt: new Date('2026-03-23T10:00:00Z'),
        },
      ],
      {
        serviceTier: 'International Express',
        carrierName: 'GIG Logistics',
        providerRateId: 'GIGL_INTL_2_1_3_1',
      }
    );

    expect(selected?.id).toBe('quote-2');
  });

  it('falls back to tier and carrier when refreshed quotes do not contain the provider rate id', () => {
    const selected = selectPreferredQuote(
      [
        {
          id: 'quote-1',
          provider: 'GIGL',
          serviceTier: 'International Express',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics - International Express',
          estimatedDays: 5,
          price: 120000,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          providerRateId: 'GIGL_INTL_2_0_0_1',
          expiresAt: new Date('2026-03-23T10:00:00Z'),
        },
      ],
      {
        serviceTier: 'International Express',
        carrierName: 'GIG Logistics',
        providerRateId: 'GIGL_INTL_2_1_3_1',
      }
    );

    expect(selected?.id).toBe('quote-1');
  });

  it('builds shipment items with the default order-booking weight', () => {
    expect(
      toShipmentItems([
        { name: 'Laptop', quantity: 2, price: 250000 },
        { name: null, quantity: null, price: null },
      ])
    ).toEqual([
      {
        name: 'Laptop',
        description: 'Laptop',
        quantity: 2,
        weight: 1,
        value: 250000,
      },
      {
        name: 'Order item',
        description: 'Order item',
        quantity: 1,
        weight: 1,
        value: 0,
      },
    ]);
  });

  it('derives city and state from the tail of a merchant business address', () => {
    expect(
      deriveMerchantLocation('12 Allen Avenue, Ikeja, Lagos')
    ).toMatchObject({
      address: '12 Allen Avenue, Ikeja, Lagos',
      city: 'Ikeja',
      state: 'Lagos',
    });
  });

  it('does not treat a trailing postal code as the merchant state', () => {
    expect(
      deriveMerchantLocation('29 Yedseram Crescent, Maitama, 904101')
    ).toMatchObject({
      address: '29 Yedseram Crescent, Maitama, 904101',
      city: 'Maitama',
      state: '',
    });
  });

  it('falls back to the final segment when a two-part address starts with a street', () => {
    expect(deriveMerchantLocation('12 Allen Avenue, Ikeja')).toMatchObject({
      address: '12 Allen Avenue, Ikeja',
      city: 'Ikeja',
      state: 'Ikeja',
    });
  });

  it('requires a complete receiver address', () => {
    expect(() =>
      buildReceiver({
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        customer_phone: '08000000000',
        shipping_address: {
          address: '12 Allen Avenue',
          city: '',
          state: 'Lagos',
        },
      })
    ).toThrow('This order is missing a complete shipping address.');
  });

  it('preserves international receiver country fields from the order address', () => {
    expect(
      buildReceiver({
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        customer_phone: '08000000000',
        shipping_address: {
          address: '123 Queen Street West',
          city: 'Toronto',
          state: 'Ontario',
          country: 'Canada',
          countryCode: 'CA',
          postalCode: 'M5V 3L9',
        },
      })
    ).toMatchObject({
      country: 'Canada',
      countryCode: 'CA',
      postalCode: 'M5V 3L9',
    });
  });
});
