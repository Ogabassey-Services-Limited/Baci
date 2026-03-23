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
});
