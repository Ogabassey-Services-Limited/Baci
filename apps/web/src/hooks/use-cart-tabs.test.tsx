import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { CartProvider, useCart } from './use-cart';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = vi.fn();

describe('useCart - Cross-Tab Synchronization', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const mockProduct = {
    id: 'p1',
    name: 'Product 1',
    price: 100,
    stock: 10,
    images: [],
    slug: 'p1',
  } as unknown as Product;

  it('updates cart state when storage event is fired (another tab updates cart)', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    // Wait for hydration
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // Initially empty
    expect(result.current.cart).toHaveLength(0);

    // Simulate another tab updating localStorage
    const newCart = [{ ...mockProduct, quantity: 1, cartItemId: 'p1' }];
    const newCartJson = JSON.stringify(newCart);
    const storageKey = 'baci-cart-guest'; // Default key for guest cart

    // Update localStorage directly (mimicking other tab)
    localStorageMock.setItem(storageKey, newCartJson);

    // Dispatch storage event manually
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: storageKey,
          newValue: newCartJson,
          storageArea: null,
        })
      );
    });

    // Expect cart state to update
    await waitFor(() => {
      expect(result.current.cart).toHaveLength(1);
      expect(result.current.cart[0].id).toBe('p1');
    });
  });

  it('clears cart when storage event clears the key', async () => {
    // Setup initial cart
    const initialCart = [{ ...mockProduct, quantity: 1, cartItemId: 'p1' }];
    localStorageMock.setItem('baci-cart-guest', JSON.stringify(initialCart));

    const wrapper = ({ children }: { children: ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.cart).toHaveLength(1);

    // Simulate another tab clearing the cart
    const storageKey = 'baci-cart-guest';
    localStorageMock.removeItem(storageKey);

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: storageKey,
          newValue: null,
          storageArea: null,
        })
      );
    });

    // Expect cart to be cleared
    await waitFor(() => {
      expect(result.current.cart).toHaveLength(0);
    });
  });
});
