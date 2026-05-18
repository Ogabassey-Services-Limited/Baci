import { describe, expect, it } from 'vitest';
import { cartValidateSchema } from './cart';

const PRODUCT_ID = 'product-1';
const VARIANT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_VARIANT_ID = '44444444-4444-4444-8444-444444444444';

describe('cartValidateSchema', () => {
  it('accepts variant-aware cart validation items', () => {
    const result = cartValidateSchema.safeParse({
      cartItems: [
        {
          id: PRODUCT_ID,
          price: 100,
          variantId: VARIANT_ID,
        },
        {
          id: 'product-2',
          price: 200,
          variant_id: OTHER_VARIANT_ID,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.cartItems).toEqual([
      {
        id: PRODUCT_ID,
        price: 100,
        variantId: VARIANT_ID,
      },
      {
        id: 'product-2',
        price: 200,
        variant_id: OTHER_VARIANT_ID,
      },
    ]);
  });

  it('rejects non-UUID variant ids', () => {
    const result = cartValidateSchema.safeParse({
      cartItems: [
        {
          id: PRODUCT_ID,
          price: 100,
          variantId: 'variant-1',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects conflicting variantId and variant_id', () => {
    const result = cartValidateSchema.safeParse({
      cartItems: [
        {
          id: PRODUCT_ID,
          price: 100,
          variantId: VARIANT_ID,
          variant_id: OTHER_VARIANT_ID,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects cartItems larger than 50 entries', () => {
    const cartItems = Array.from({ length: 51 }, (_, index) => ({
      id: `product-${index}`,
      price: 100 + index,
    }));

    const result = cartValidateSchema.safeParse({ cartItems });

    expect(result.success).toBe(false);
  });

  it('rejects productIds larger than 50 entries', () => {
    const productIds = Array.from({ length: 51 }, (_, index) => `id-${index}`);

    const result = cartValidateSchema.safeParse({ productIds });

    expect(result.success).toBe(false);
  });
});
