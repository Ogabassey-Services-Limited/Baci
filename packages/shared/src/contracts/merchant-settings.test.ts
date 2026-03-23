import { describe, expect, it } from 'vitest';
import {
  normalizeRegisteredAddress,
  normalizeSocialMediaValues,
} from './merchant-settings';

describe('merchant settings contracts', () => {
  it('drops empty social media handles', () => {
    expect(
      normalizeSocialMediaValues({
        instagram: ' @baci ',
        twitter: ' ',
      })
    ).toEqual({
      instagram: '@baci',
    });
  });

  it('returns null when a registered address is empty', () => {
    expect(
      normalizeRegisteredAddress({
        street: ' ',
        city: '',
        state: null,
      })
    ).toBeNull();
  });

  it('normalizes address fields when values are present', () => {
    expect(
      normalizeRegisteredAddress({
        street: ' 12 Allen Avenue ',
        city: ' Ikeja ',
        country: ' Nigeria ',
      })
    ).toEqual({
      street: '12 Allen Avenue',
      city: 'Ikeja',
      state: null,
      postal_code: null,
      country: 'Nigeria',
    });
  });
});
