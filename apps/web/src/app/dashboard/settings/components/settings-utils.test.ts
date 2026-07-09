import { describe, expect, it } from 'vitest';
import { sanitizeSocialMedia, settingsSchema } from './settings-utils';

describe('settingsSchema', () => {
  it('accepts a valid business name and country', () => {
    expect(
      settingsSchema.safeParse({ business_name: 'My Store', country: 'NG' })
        .success
    ).toBe(true);
  });

  it('trims surrounding whitespace on business_name', () => {
    const result = settingsSchema.safeParse({
      business_name: '  Zorvexa  ',
      country: 'NG',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.business_name).toBe('Zorvexa');
    }
  });

  it('rejects a business name shorter than 2 characters after trimming', () => {
    // Trimming happens before the length check, so " a " collapses to "a".
    expect(
      settingsSchema.safeParse({ business_name: ' a ', country: 'NG' }).success
    ).toBe(false);
  });

  it('rejects a country shorter than 2 characters', () => {
    expect(
      settingsSchema.safeParse({ business_name: 'My Store', country: 'N' })
        .success
    ).toBe(false);
  });

  it('accepts an INR-market country code (IN) unchanged', () => {
    const result = settingsSchema.safeParse({
      business_name: 'My Store',
      country: 'IN',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe('IN');
    }
  });

  it('normalizes a full country name to its ISO-2 code instead of writing it verbatim', () => {
    const result = settingsSchema.safeParse({
      business_name: 'My Store',
      country: 'Nigeria',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe('NG');
    }
  });

  it('rejects an unrecognizable country instead of persisting garbage', () => {
    expect(
      settingsSchema.safeParse({
        business_name: 'My Store',
        country: 'Wakanda',
      }).success
    ).toBe(false);
  });
});

describe('sanitizeSocialMedia', () => {
  it('trims each value and preserves keys', () => {
    const result = sanitizeSocialMedia({
      instagram: '  baci  ',
      twitter: 'baci',
    });
    expect(result.instagram).toBe('baci');
    expect(result.twitter).toBe('baci');
  });

  it('returns an empty object for empty input', () => {
    expect(sanitizeSocialMedia({})).toEqual({});
  });
});
