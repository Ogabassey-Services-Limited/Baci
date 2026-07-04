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

  it('accepts an optional merchantSlug and products array (backward compatible)', () => {
    const result = internalRevalidateProductsBodySchema.safeParse({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      products: [
        { slug: 'iphone-15', category: 'Smartphones' },
        { id: 'prod-2', categorySlug: 'tablets' },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.products).toHaveLength(2);
  });

  it('still accepts a merchantId-only body (no purge fields)', () => {
    const result = internalRevalidateProductsBodySchema.safeParse({
      merchantId: 'merchant-1',
    });
    expect(result.success).toBe(true);
    expect(result.data?.products).toBeUndefined();
    expect(result.data?.merchantSlug).toBeUndefined();
  });

  it('rejects a product entry with neither a slug nor an id', () => {
    const result = internalRevalidateProductsBodySchema.safeParse({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      products: [{ category: 'Smartphones' }],
    });
    expect(result.success).toBe(false);
  });
});
