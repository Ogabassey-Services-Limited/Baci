import { describe, expect, it } from 'vitest';
import {
  RegisteredAddressSchema,
  SocialMediaSchema,
} from './merchant-settings';

describe('merchant settings schemas', () => {
  it('accepts partial social media handles', () => {
    expect(
      SocialMediaSchema.safeParse({
        instagram: '@baci',
        tiktok: '@usebaci',
      }).success
    ).toBe(true);
  });

  it('accepts a sparse registered address payload', () => {
    expect(
      RegisteredAddressSchema.safeParse({
        street: '12 Marina Road',
        city: 'Lagos',
        postal_code: null,
      }).success
    ).toBe(true);
  });

  it('rejects non-string social media handles', () => {
    const result = SocialMediaSchema.safeParse({
      instagram: 123,
      tiktok: { handle: '@usebaci' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['instagram', 'tiktok'])
    );
  });

  it('rejects invalid registered address field types', () => {
    const result = RegisteredAddressSchema.safeParse({
      street: 42,
      city: { name: 'Lagos' },
      postal_code: ['101001'],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['street', 'city', 'postal_code'])
    );
  });
});
