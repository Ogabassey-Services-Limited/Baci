import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from './use-cart';

type AddToCartProduct = Parameters<ReturnType<typeof useCart>['addToCart']>[0];

// Mock logger to avoid console clutter
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

describe('useCart - Validation', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const mockProduct = {
    id: 'prod-1',
    merchant_id: 'merch-1',
    name: 'Test Product',
    description: '',
    status: 'active' as const,
    price: 100,
    manage_stock: true,
    stock: 10,
    image: '',
    imageLarge: '',
    imageHint: '',
    brand: 'Test Brand',
    gtin: '',
    mpn: '',
    slug: 'test-product',
    images: [],
    category_id: 'cat-1',
    sku: 'SKU-1',
  };

  it('removes ghost products and updates prices', async () => {
    // Setup initial cart with 2 products
    const initialCart = [
      { ...mockProduct, id: 'ghost-product', cartItemId: 'ghost-product' },
      {
        ...mockProduct,
        id: 'price-change-product',
        price: 100,
        cartItemId: 'price-change-product',
      },
      { ...mockProduct, id: 'valid-product', cartItemId: 'valid-product' },
    ];

    localStorageMock.setItem('baci-cart-guest', JSON.stringify(initialCart));

    // Mock validation response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        invalidProductIds: ['ghost-product'],
        priceChanges: [
          { id: 'price-change-product', oldPrice: 100, newPrice: 150 },
        ],
      }),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    // Wait for hydration
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // Initial state check (before validation effect kicks in)
    // Note: The validation has a 500ms delay + async fetch

    // Wait for validation to complete
    await waitFor(
      () => {
        // Ghost product should be gone
        const ghost = result.current.cart.find((i) => i.id === 'ghost-product');
        expect(ghost).toBeUndefined();

        // Price should be updated
        const updated = result.current.cart.find(
          (i) => i.id === 'price-change-product'
        );
        expect(updated?.price).toBe(150);

        // Valid product should remain
        const valid = result.current.cart.find((i) => i.id === 'valid-product');
        expect(valid).toBeDefined();
      },
      { timeout: 2000 }
    );
  });

  it('handles empty or missing validation data safely', async () => {
    // Setup initial cart
    const initialCart = [
      { ...mockProduct, id: 'valid-product', cartItemId: 'valid-product' },
    ];

    localStorageMock.setItem('baci-cart-guest', JSON.stringify(initialCart));

    // Mock empty response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // Empty object, fields missing
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // Should not crash and cart should remain
    await waitFor(
      () => {
        expect(result.current.cart).toHaveLength(1);
      },
      { timeout: 2000 }
    );
  });

  it('auto-selects the cheapest available variant for quick add flows', async () => {
    const variantProduct: AddToCartProduct = {
      ...mockProduct,
      id: 'variant-product',
      has_variants: true,
      manage_stock: true,
      variants: [
        {
          id: 'variant-256',
          product_id: 'variant-product',
          merchant_id: 'merch-1',
          price_override: 150,
          stock_quantity: 2,
          attributes: { storage: '256GB' },
        },
        {
          id: 'variant-128',
          product_id: 'variant-product',
          merchant_id: 'merch-1',
          price_override: 100,
          stock_quantity: 5,
          attributes: { storage: '128GB' },
        },
      ],
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        invalidProductIds: [],
        priceChanges: [],
      }),
    });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      result.current.addToCart(variantProduct, 1);
    });

    await waitFor(() => {
      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0]).toMatchObject({
        id: 'variant-product',
        variantId: 'variant-128',
        selectedStorage: '128GB',
        price: 100,
      });
    });
  });
});
