import { describe, expect, it } from 'vitest';
import {
  buildReceiver,
  deriveMerchantLocation,
  domesticSendersDiffer,
  OrderShipmentBookingError,
  parseStoredQuoteRequest,
  toShipmentItems,
} from './order-shipment-booking-utils';

const baseSender = {
  name: 'Merchant',
  phone: '08000000000',
  address: '2 Olaide Tomori Street, Ikeja, Lagos, 100001',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};

describe('deriveMerchantLocation', () => {
  describe('bugfix: street, city, state, postal_code business addresses', () => {
    it('preserves the city when the segment before a trailing postal code is a state', () => {
      const location = deriveMerchantLocation(
        '2 Olaide Tomori Street, Ikeja, Lagos, 100001'
      );

      expect(location).toEqual({
        address: '2 Olaide Tomori Street, Ikeja, Lagos, 100001',
        city: 'Ikeja',
        state: 'Lagos',
      });
    });
  });

  it('returns Maitama with an empty state for postal-code-only legacy addresses', () => {
    expect(
      deriveMerchantLocation('29 Yedseram Crescent, Maitama, 904101')
    ).toEqual({
      address: '29 Yedseram Crescent, Maitama, 904101',
      city: 'Maitama',
      state: '',
    });
  });

  it('falls back to the locality before an unknown-state postal code', () => {
    expect(deriveMerchantLocation('12 Example Road, Kubwa, 900001')).toEqual({
      address: '12 Example Road, Kubwa, 900001',
      city: 'Kubwa',
      state: '',
    });
  });
});

describe('domesticSendersDiffer', () => {
  it('returns false when city and state match after normalization', () => {
    expect(
      domesticSendersDiffer(baseSender, {
        ...baseSender,
        city: ' ikeja ',
        state: 'LAGOS',
      })
    ).toBe(false);
  });

  it('returns true when only the city differs', () => {
    expect(
      domesticSendersDiffer(baseSender, {
        ...baseSender,
        city: 'Lagos',
      })
    ).toBe(true);
  });

  it('returns true when only the state differs', () => {
    expect(
      domesticSendersDiffer(baseSender, {
        ...baseSender,
        state: 'Abuja',
      })
    ).toBe(true);
  });
});

describe('parseStoredQuoteRequest', () => {
  it('normalizes domestic quote receiver country defaults', () => {
    const parsed = parseStoredQuoteRequest({
      sessionId: 'session-1',
      shipmentType: 'domestic',
      receiver: {
        name: 'Customer',
        phone: '08000000001',
        address: 'Receiver Road',
        city: 'Abuja',
        state: 'Abuja',
        country: '',
        countryCode: '',
      },
      items: [{ name: 'Widget', quantity: 1, weight: 1, value: 5000 }],
    });

    expect(parsed).toMatchObject({
      shipmentType: 'domestic',
      receiver: expect.objectContaining({
        country: 'Nigeria',
        countryCode: 'NG',
      }),
    });
  });

  it('returns null when receiver data is incomplete', () => {
    expect(parseStoredQuoteRequest({ items: [] })).toBeNull();
  });
});

describe('buildReceiver', () => {
  it('builds a receiver from complete order shipping data', () => {
    expect(
      buildReceiver({
        customer_name: 'Jane Customer',
        customer_email: 'jane@example.com',
        customer_phone: '08012345678',
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
      name: 'Jane Customer',
      city: 'Toronto',
      state: 'Ontario',
      country: 'Canada',
      countryCode: 'CA',
      postalCode: 'M5V 3L9',
    });
  });

  it('throws when the order shipping address is incomplete', () => {
    expect(() =>
      buildReceiver({
        customer_name: 'Jane Customer',
        customer_email: null,
        customer_phone: null,
        shipping_address: {
          address: '123 Queen Street West',
          city: null,
          state: 'Ontario',
        },
      })
    ).toThrow(OrderShipmentBookingError);
  });
});

describe('toShipmentItems', () => {
  it('maps order items to shipment items with safe defaults', () => {
    expect(
      toShipmentItems([
        { name: 'Widget', quantity: 2, price: '5000' },
        { name: null, quantity: null, price: null },
      ])
    ).toEqual([
      {
        name: 'Widget',
        description: 'Widget',
        quantity: 2,
        weight: 1,
        value: 5000,
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
});
