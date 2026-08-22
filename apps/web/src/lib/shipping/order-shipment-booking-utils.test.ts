import { describe, expect, it } from 'vitest';
import { deriveMerchantLocation } from './order-shipment-booking-utils';

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
});
