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

describe('useCart', () => {
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

  describe('Validation', () => {
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
  });

  describe('Guest Cart Merge', () => {
    const mockGuestProduct = {
      ...mockProduct,
      id: 'prod-guest',
      name: 'Guest Product',
      sku: 'SKU-GUEST',
      cartItemId: 'prod-guest',
      quantity: 1,
    };

    it('merges guest cart into user cart on login', async () => {
      // 1. Seed guest cart in localStorage
      const guestCart = [mockGuestProduct];
      localStorageMock.setItem('baci-cart-guest', JSON.stringify(guestCart));

      // 2. Render CartProvider as a logged-in user (userId="user-1")
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CartProvider userId="user-1">{children}</CartProvider>
      );

      const { result } = renderHook(() => useCart(), { wrapper });

      // 3. Wait for hydration
      await waitFor(() => expect(result.current.isHydrated).toBe(true));

      // 4. Expect the cart to contain the guest item
      await waitFor(() => {
        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].id).toBe('prod-guest');
      });
    });

    it('clears guest cart after merge', async () => {
       // 1. Seed guest cart
       const guestCart = [mockGuestProduct];
       localStorageMock.setItem('baci-cart-guest', JSON.stringify(guestCart));

       // 2. Render User Cart
       const wrapper = ({ children }: { children: React.ReactNode }) => (
         <CartProvider userId="user-1">{children}</CartProvider>
       );

       const { result } = renderHook(() => useCart(), { wrapper });
       await waitFor(() => expect(result.current.isHydrated).toBe(true));

       // 3. Check if guest cart is cleared from storage
       expect(localStorageMock.getItem('baci-cart-guest')).toBeNull();
    });
  });
});
