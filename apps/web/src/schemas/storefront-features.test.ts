import { describe, expect, it } from 'vitest';
import { storefrontFeaturesQuerySchema } from '@/schemas/storefront-features';

describe('storefrontFeaturesQuerySchema', () => {
  it('accepts a valid merchantId', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({
      merchantId: '00000000-0000-4000-8000-000000000001',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a trimmed slug', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({
      slug: ' test-store ',
    });

    expect(result.success).toBe(true);
    expect(result.data?.slug).toBe('test-store');
  });

  it('rejects missing merchantId and slug', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'merchantId or slug is required'
    );
  });

  it('rejects an invalid merchantId', () => {
    const result = storefrontFeaturesQuerySchema.safeParse({
      merchantId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Invalid merchantId');
  });
});
