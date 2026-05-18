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
