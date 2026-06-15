import { describe, expect, it } from 'vitest';
import { internalRevalidateProductsBodySchema } from '@/schemas/internal-revalidate-products-route';

describe('internalRevalidateProductsBodySchema', () => {
  it('accepts a non-empty merchantId and trims it', () => {
    const result = internalRevalidateProductsBodySchema.safeParse({
      merchantId: '  merchant-1  ',
    });
    expect(result.success).toBe(true);
    expect(result.data?.merchantId).toBe('merchant-1');
  });

  it('rejects a missing merchantId', () => {
    expect(internalRevalidateProductsBodySchema.safeParse({}).success).toBe(
      false
    );
  });

  it('rejects a blank merchantId', () => {
    expect(
      internalRevalidateProductsBodySchema.safeParse({ merchantId: '   ' })
        .success
    ).toBe(false);
  });

  it('rejects a non-string merchantId', () => {
    expect(
      internalRevalidateProductsBodySchema.safeParse({ merchantId: 123 })
        .success
    ).toBe(false);
  });
});
