import { describe, expect, it } from 'vitest';
import { googleMerchantFeedQuerySchema } from '@/schemas/google-merchant-feed-query';

describe('googleMerchantFeedQuerySchema', () => {
  it('accepts a merchant slug without a merchant id', () => {
    const result = googleMerchantFeedQuerySchema.safeParse({
      merchant_slug: 'ogabassey',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ merchant_slug: 'ogabassey' });
    }
  });

  it('accepts a merchant id without a merchant slug', () => {
    const result = googleMerchantFeedQuerySchema.safeParse({
      merchant_id: '00000000-0000-4000-8000-000000000001',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        merchant_id: '00000000-0000-4000-8000-000000000001',
      });
    }
  });

  it('accepts a 255-character merchant slug', () => {
    const result = googleMerchantFeedQuerySchema.safeParse({
      merchant_slug: 'a'.repeat(255),
    });

    expect(result.success).toBe(true);
  });

  it('fails when no merchant identifier is provided', () => {
    expect(googleMerchantFeedQuerySchema.safeParse({}).success).toBe(false);
  });

  it('fails when both merchant_id and merchant_slug are provided', () => {
    expect(
      googleMerchantFeedQuerySchema.safeParse({
        merchant_id: '00000000-0000-4000-8000-000000000001',
        merchant_slug: 'ogabassey',
      }).success
    ).toBe(false);
  });

  it('rejects non-UUID merchant ids', () => {
    expect(
      googleMerchantFeedQuerySchema.safeParse({
        merchant_id: 'not-a-uuid',
      }).success
    ).toBe(false);
  });

  it.each([
    ['empty merchant slugs', ''],
    ['whitespace merchant slugs', '   '],
    ['merchant slugs with invalid characters', '!@#$%'],
    ['merchant slugs over 255 characters', 'a'.repeat(256)],
  ])('rejects %s', (_caseName, merchantSlug) => {
    expect(
      googleMerchantFeedQuerySchema.safeParse({
        merchant_slug: merchantSlug,
      }).success
    ).toBe(false);
  });
});
