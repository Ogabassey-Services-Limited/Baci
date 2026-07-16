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

  it('derives legacy office geography from a comma-separated address', () => {
    expect(
      getMerchantPickupLocation({
        business_address: '2 Olaide Tomori St, Ikeja, Lagos',
        business_name: 'OgaBassey',
        registered_address: null,
      })
    ).toEqual({
      address: '2 Olaide Tomori St, Ikeja, Lagos',
      city: 'Ikeja',
      label: 'OgaBassey Office',
      state: 'Lagos',
    });
  });

  it('uses the registered address when the legacy address is absent', () => {
    expect(
      getMerchantPickupLocation({
        business_name: 'OgaBassey',
        registered_address: {
          city: 'Ikeja',
          state: 'Lagos',
          street: '2 Olaide Tomori St',
        },
      })
    ).toEqual({
      address: '2 Olaide Tomori St',
      city: 'Ikeja',
      label: 'OgaBassey Office',
      state: 'Lagos',
    });
  });

  it('does not guess legacy geography from an unstructured address', () => {
    expect(
      getMerchantPickupLocation({
        business_address: 'Taiyelolu Towers First Floor',
        business_name: 'OgaBassey',
        registered_address: null,
      })
    ).toBeUndefined();
  });

  it.each([
    { city: ' ', state: 'Lagos' },
    { city: 'Ikeja', state: ' ' },
  ])('falls back when structured office geography is incomplete', (registeredAddress) => {
    expect(
      getMerchantPickupLocation({
        business_address: '2 Olaide Tomori St, Ikeja, Lagos',
        business_name: 'OgaBassey',
        registered_address: registeredAddress,
      })
    ).toMatchObject({
      city: 'Ikeja',
      state: 'Lagos',
    });
  });
});
