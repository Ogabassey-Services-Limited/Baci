import { describe, expect, it } from '@jest/globals';
import { getMerchantPickupLocation } from './merchant-pickup-location';

describe('getMerchantPickupLocation', () => {
  it('builds the office pickup location from fetched merchant data', () => {
    expect(
      getMerchantPickupLocation({
        business_address: '2 Olaide Tomori St, Ikeja, Lagos',
        business_name: 'OgaBassey',
        registered_address: {
          city: 'Ikeja',
          state: 'Lagos',
          street: '2 Olaide Tomori St',
        },
      })
    ).toEqual({
      address: '2 Olaide Tomori St, Ikeja, Lagos',
      city: 'Ikeja',
      label: 'OgaBassey Office',
      state: 'Lagos',
    });
  });

  it('returns undefined when the merchant has no office address', () => {
    expect(
      getMerchantPickupLocation({
        business_address: ' ',
        business_name: 'OgaBassey',
      })
    ).toBeUndefined();
  });

  it.each([
    { city: ' ', state: 'Lagos' },
    { city: 'Ikeja', state: ' ' },
  ])('returns undefined for incomplete office geography', (registeredAddress) => {
    expect(
      getMerchantPickupLocation({
        business_address: '2 Olaide Tomori St, Ikeja, Lagos',
        business_name: 'OgaBassey',
        registered_address: registeredAddress,
      })
    ).toBeUndefined();
  });
});
