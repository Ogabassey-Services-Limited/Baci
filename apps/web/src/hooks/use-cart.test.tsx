import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from './use-cart';

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
    name: 'Test Product',
    price: 100,
    slug: 'test-product',
    images: [],
    description: '',
    category_id: 'cat-1',
    merchant_id: 'merch-1',
    created_at: '',
    updated_at: '',
    stock: 10,
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

  it('safely handles malformed cart data in localStorage', async () => {
    const malformedData = [
      null,
      'string',
      { id: 'ok', name: 'Valid Item', price: 100 },
      { id: 'no-name' },
      { name: 'no-id' },
      { id: 123, name: 'wrong-id-type' }, // ID should be string
    ];

    localStorageMock.setItem('baci-cart-guest', JSON.stringify(malformedData));

    // Mock validation to avoid network errors in logs
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // Only one valid item should remain
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].id).toBe('ok');
    expect(result.current.cart[0].name).toBe('Valid Item');
  });
});
