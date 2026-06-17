import { describe, expect, it } from 'vitest';
import {
  type MerchantSettingsUpdatePayload,
  mergeSocialMediaValues,
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

  it('merges a partial social payload over existing handles (untouched survive)', () => {
    expect(
      mergeSocialMediaValues(
        { twitter: '@oga', facebook: 'fb.com/oga', instagram: '@old' },
        { instagram: '@new' }
      )
    ).toEqual({
      twitter: '@oga',
      facebook: 'fb.com/oga',
      instagram: '@new',
    });
  });

  it('collapses to {} only when every merged handle is blank', () => {
    expect(
      mergeSocialMediaValues({ twitter: '@oga' }, { twitter: '  ' })
    ).toEqual({});
  });

  it('treats a null existing value as an empty base', () => {
    expect(mergeSocialMediaValues(null, { twitter: ' @baci ' })).toEqual({
      twitter: '@baci',
    });
  });

  it('accepts an explicit clear_social_media flag on the update payload', () => {
    const payload: MerchantSettingsUpdatePayload = {
      social_media: {},
      clear_social_media: true,
    };

    expect(payload.clear_social_media).toBe(true);
  });
});
