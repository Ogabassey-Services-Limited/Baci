import { describe, expect, it } from 'vitest';
import { cartValidateSchema } from './cart';

describe('cartValidateSchema', () => {
  it('accepts variant-aware cart validation items', () => {
    const result = cartValidateSchema.safeParse({
      cartItems: [
        {
          id: 'product-1',
          price: 100,
          variantId: 'variant-1',
        },
        {
          id: 'product-2',
          price: 200,
          variant_id: 'variant-2',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.cartItems).toEqual([
      {
        id: 'product-1',
        price: 100,
        variantId: 'variant-1',
      },
      {
        id: 'product-2',
        price: 200,
        variant_id: 'variant-2',
      },
    ]);
  });
});
