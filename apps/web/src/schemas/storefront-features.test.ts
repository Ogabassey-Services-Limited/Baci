import { describe, expect, it } from 'vitest';
import { storefrontFeaturesQuerySchema } from './storefront-features';

describe('storefrontFeaturesQuerySchema', () => {
  it('accepts a valid merchantId', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({
      merchantId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a valid slug', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({
      slug: 'test-store',
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing merchantId and slug', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'merchantId or slug is required'
      );
    }
  });

  it('rejects an invalid merchantId', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({
      merchantId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Invalid merchantId');
    }
  });
});
