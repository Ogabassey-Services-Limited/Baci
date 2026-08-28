import { describe, expect, it } from 'vitest';
import { validateAirportDeliveryAddress } from './airport-delivery-address';

describe('validateAirportDeliveryAddress', () => {
  it('accepts a complete local airport delivery address', () => {
    expect(() =>
      validateAirportDeliveryAddress({
        airportType: 'delivery',
        deliveryMethod: 'airport',
        shippingAddress: {
          address: '12 Airport Road',
          city: 'Ikeja',
          state: 'Lagos',
        },
      })
    ).not.toThrow();
  });

  it('rejects a local airport delivery without address, city, or state', () => {
    expect(() =>
      validateAirportDeliveryAddress({
        airportType: 'delivery',
        deliveryMethod: 'airport',
      })
    ).toThrowError(
      expect.objectContaining({ code: 'AIRPORT_ADDRESS_REQUIRED' })
    );
  });
});
