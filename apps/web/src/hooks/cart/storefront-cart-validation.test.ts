import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from './cart-types';
import {
  applyValidationResults,
  createCartHash,
  validateStorefrontCart,
} from './storefront-cart-validation';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.stubGlobal('fetch', mocks.fetch);

vi.mock('@/lib/logger', () => ({
  logger: mocks.logger,
}));

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'cart-item-1',
    cartItemId: 'cart-item-1',
    name: 'iPhone 16',
    description: '',
    status: 'active',
    price: 1200000,
    manage_stock: true,
    stock: 1,
    image: '/iphone-16.png',
    imageLarge: '/iphone-16.png',
    imageHint: 'iphone 16',
    brand: 'Apple',
    gtin: '',
    mpn: '',
    quantity: 1,
    ...overrides,
  };
}

describe('storefront-cart-validation', () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.logger.info.mockReset();
    mocks.logger.warn.mockReset();
  });

  it('creates a stable hash from cart contents regardless of order', () => {
    const first = createCartHash([
      makeCartItem({ id: 'b', cartItemId: 'b', price: 20, variantId: 'v-b' }),
      makeCartItem({ id: 'a', cartItemId: 'a', price: 10 }),
    ]);
    const second = createCartHash([
      makeCartItem({ id: 'a', cartItemId: 'a', price: 10 }),
      makeCartItem({ id: 'b', cartItemId: 'b', price: 20, variantId: 'v-b' }),
    ]);

    expect(first).toBe(second);
    expect(first).toBe('a:::10|b::v-b:::20');
  });

  it('includes variant and condition identity in the cart validation hash', () => {
    expect(
      createCartHash([
        makeCartItem({
          id: 'iphone-15',
          cartItemId: 'iphone-15::variant=used',
          condition: 'used',
          price: 829000,
          variantId: 'variant-used',
        }),
      ])
    ).toBe('iphone-15::variant-used:used::829000');
  });

  it('posts the first 50 cart items for validation and returns the response body', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ invalidProductIds: ['cart-item-1'] }),
    });
    const controller = new AbortController();

    const result = await validateStorefrontCart(
      Array.from({ length: 55 }, (_, index) =>
        makeCartItem({
          id: `cart-item-${index + 1}`,
          cartItemId: `cart-item-${index + 1}`,
          price: index + 1,
          variantId: index === 0 ? 'variant-1' : undefined,
        })
      ),
      controller.signal
    );

    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/cart/validate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: Array.from({ length: 50 }, (_, index) => ({
            id: `cart-item-${index + 1}`,
            price: index + 1,
            variantId: index === 0 ? 'variant-1' : undefined,
          })),
        }),
        signal: controller.signal,
      })
    );
    expect(result).toEqual({ invalidProductIds: ['cart-item-1'] });
  });

  it('posts SKU-matrix variant identity for server-side validation', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ invalidProductIds: [] }),
    });
    const controller = new AbortController();

    await validateStorefrontCart(
      [
        makeCartItem({
          id: 'iphone-15',
          condition: 'open_box',
          price: 829000,
          variantAttributes: {
            color: 'Black',
            sim_type: 'eSIM Only',
            storage: '128GB',
          },
          variantId: 'iphone15-openbox-128-black-esim',
        }),
      ],
      controller.signal
    );

    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/cart/validate',
      expect.objectContaining({
        body: JSON.stringify({
          cartItems: [
            {
              condition: 'open_box',
              id: 'iphone-15',
              price: 829000,
              variantAttributes: {
                color: 'Black',
                sim_type: 'eSIM Only',
                storage: '128GB',
              },
              variantId: 'iphone15-openbox-128-black-esim',
            },
          ],
        }),
        signal: controller.signal,
      })
    );
  });

  it('returns null and warns when validation fails', async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await validateStorefrontCart(
      [makeCartItem({ price: 99 })],
      new AbortController().signal
    );

    expect(result).toBeNull();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cart validation failed',
        status: 503,
      })
    );
  });

  it('removes invalid items and updates stale prices', () => {
    const result = applyValidationResults(
      [
        makeCartItem({
          id: 'cart-item-1',
          cartItemId: 'cart-item-1',
          price: 100,
        }),
        makeCartItem({
          id: 'cart-item-2',
          cartItemId: 'cart-item-2',
          price: 200,
        }),
        makeCartItem({
          id: 'cart-item-3',
          cartItemId: 'cart-item-3',
          price: 300,
        }),
      ],
      {
        invalidProductIds: ['cart-item-1'],
        priceChanges: [{ id: 'cart-item-2', oldPrice: 200, newPrice: 250 }],
      }
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'cart-item-2',
        cartItemId: 'cart-item-2',
        price: 250,
        quantity: 1,
      }),
      expect.objectContaining({
        id: 'cart-item-3',
        cartItemId: 'cart-item-3',
        price: 300,
        quantity: 1,
      }),
    ]);
    expect(mocks.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Updated stale price in cart',
        productId: 'cart-item-2',
      })
    );
  });

  it('applies variant-specific price changes only to the matching cart line', () => {
    const result = applyValidationResults(
      [
        makeCartItem({
          id: 'product-1',
          cartItemId: 'product-1::variant-a',
          variantId: 'variant-a',
          price: 100,
        }),
        makeCartItem({
          id: 'product-1',
          cartItemId: 'product-1::variant-b',
          variantId: 'variant-b',
          price: 200,
        }),
      ],
      {
        priceChanges: [
          {
            id: 'product-1',
            variantId: 'variant-b',
            oldPrice: 200,
            newPrice: 250,
          },
        ],
      }
    );

    expect(result).toEqual([
      expect.objectContaining({
        cartItemId: 'product-1::variant-a',
        price: 100,
      }),
      expect.objectContaining({
        cartItemId: 'product-1::variant-b',
        price: 250,
      }),
    ]);
  });

  it('invalidates only the targeted variant cart line key', () => {
    const result = applyValidationResults(
      [
        makeCartItem({
          id: 'product-1',
          cartItemId: 'product-1::variant-a',
          variantId: 'variant-a',
          price: 100,
        }),
        makeCartItem({
          id: 'product-1',
          cartItemId: 'product-1::variant-b',
          variantId: 'variant-b',
          price: 200,
        }),
      ],
      {
        invalidProductIds: ['product-1::variant-b'],
      }
    );

    expect(result).toEqual([
      expect.objectContaining({
        cartItemId: 'product-1::variant-a',
        price: 100,
      }),
    ]);
  });

  it('returns the original cart when validation reports no changes', () => {
    const cart = [makeCartItem({ price: 100 })];

    expect(
      applyValidationResults(cart, {
        invalidProductIds: [],
        priceChanges: [],
      })
    ).toBe(cart);
  });
});
