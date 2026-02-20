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
const fetchMock = vi.fn();
global.fetch = fetchMock;

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
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        invalidProductIds: ['ghost-product'],
        priceChanges: [
          { id: 'price-change-product', oldPrice: 100, newPrice: 150 },
        ],
      }),
    } as Response);

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
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // Empty object, fields missing
    } as Response);

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

  it('filters out malformed items and normalizes legacy data from local storage', async () => {
    // Setup local storage with mixed validity items
    const mixedCart = [
      { ...mockProduct, id: 'valid-product-1', name: 'Valid Product 1' }, // Valid
      { ...mockProduct, id: 'missing-name', name: undefined }, // Invalid (missing name)
      { ...mockProduct, id: undefined, name: 'Missing ID' }, // Invalid (missing id)
      { ...mockProduct, id: 'legacy-price', price: '200' }, // Valid but legacy price (string)
      { ...mockProduct, id: 'legacy-quantity', quantity: '5' }, // Valid but legacy quantity (string)
      'invalid-string-item', // Invalid (not object)
      null, // Invalid (null)
    ];

    localStorageMock.setItem('baci-cart-guest', JSON.stringify(mixedCart));

    // Mock validation response (can be empty/success as we are testing initial load)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // Check cart content
    const cart = result.current.cart;

    // Should have 3 items: valid-product-1, legacy-price, legacy-quantity
    expect(cart).toHaveLength(3);

    const valid = cart.find((i) => i.id === 'valid-product-1');
    expect(valid).toBeDefined();

    const legacyPrice = cart.find((i) => i.id === 'legacy-price');
    expect(legacyPrice).toBeDefined();
    expect(legacyPrice?.price).toBe(200); // Should be number

    const legacyQuantity = cart.find((i) => i.id === 'legacy-quantity');
    expect(legacyQuantity).toBeDefined();
    expect(legacyQuantity?.quantity).toBe(5); // Should be number
  });
});
