import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateCartItemId,
  getCartFromStorage,
  getMerchantSlugFromStorage,
  getStorefrontCartStorageKey,
  saveCartToStorage,
  saveMerchantSlugToStorage,
} from './cart-storage';
import type { CartItem } from './cart-types';

const logger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger,
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

describe('cart-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    logger.error.mockReset();
  });

  it('builds the guest cart storage key from the merchant slug', () => {
    expect(getStorefrontCartStorageKey('ogabassey')).toBe(
      'baci-cart-ogabassey-guest'
    );
    expect(getStorefrontCartStorageKey()).toBe('baci-cart-guest');
  });

  it('creates stable cart item identifiers from options', () => {
    expect(
      generateCartItemId('product-1', {
        variantId: 'variant-1',
        color: 'Black',
        condition: 'new',
        secondaryColor: 'Silver',
        storage: '256GB',
      })
    ).toBe(
      'product-1::variant=variant-1::color=Black::secondaryColor=Silver::condition=new::storage=256GB'
    );
  });

  it('filters invalid storage entries and coerces price and quantity values', () => {
    localStorage.setItem(
      'baci-cart-ogabassey-guest',
      JSON.stringify([
        {
          id: 'cart-item-1',
          name: 'iPhone 16',
          price: '1200000',
          quantity: '2',
        },
        { id: 1, name: 'Broken item' },
      ])
    );

    expect(getCartFromStorage('ogabassey')).toEqual([
      expect.objectContaining({
        id: 'cart-item-1',
        name: 'iPhone 16',
        price: 1200000,
        quantity: 2,
      }),
    ]);
  });

  it('returns an empty cart and logs when stored JSON is invalid', () => {
    localStorage.setItem('baci-cart-guest', '{bad json');

    expect(getCartFromStorage()).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to read cart from localStorage',
      })
    );
  });

  it('persists the cart and merchant slug values', () => {
    saveCartToStorage([makeCartItem()], 'ogabassey');
    saveMerchantSlugToStorage('ogabassey');

    expect(
      JSON.parse(localStorage.getItem('baci-cart-ogabassey-guest') || '[]')
    ).toEqual([
      expect.objectContaining({ id: 'cart-item-1', name: 'iPhone 16' }),
    ]);
    expect(getMerchantSlugFromStorage()).toBe('ogabassey');

    saveMerchantSlugToStorage(null);

    expect(getMerchantSlugFromStorage()).toBeNull();
  });
});
