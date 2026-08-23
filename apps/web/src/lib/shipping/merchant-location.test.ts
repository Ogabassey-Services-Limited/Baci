import { describe, expect, it } from 'vitest';
import {
  deriveMerchantLocation,
  domesticSendersDiffer,
} from './merchant-location';

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

  describe('bugfix: matching labels with differing coordinates', () => {
    it('returns true when city and state match but latitude/longitude differ', () => {
      expect(
        domesticSendersDiffer(
          {
            ...baseSender,
            latitude: 6.45,
            longitude: 3.4,
          },
          {
            ...baseSender,
            latitude: 6.6,
            longitude: 3.35,
          }
        )
      ).toBe(true);
    });

    it('returns true when only one sender has coordinates', () => {
      expect(
        domesticSendersDiffer(
          {
            ...baseSender,
            latitude: 6.45,
            longitude: 3.4,
          },
          baseSender
        )
      ).toBe(true);
    });

    it('returns false when city, state, and coordinates all match', () => {
      expect(
        domesticSendersDiffer(
          {
            ...baseSender,
            latitude: 6.45,
            longitude: 3.4,
          },
          {
            ...baseSender,
            city: 'IKEJA',
            state: ' lagos ',
            latitude: 6.45,
            longitude: 3.4,
          }
        )
      ).toBe(false);
    });
  });
});
