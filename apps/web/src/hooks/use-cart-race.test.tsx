import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { CartProvider, useCart } from './use-cart';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn((url: RequestInfo | URL, options?: RequestInit) =>
    globalThis.fetch(url, options)
  ),
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

global.fetch = vi.fn();

describe('useCart - Race Condition', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockProduct1 = {
    id: 'p1',
    name: 'P1',
    price: 100,
    stock: 10,
    images: [],
    slug: 'p1',
  } as unknown as Product;

  const mockProduct2 = {
    id: 'p2',
    name: 'P2',
    price: 200,
    stock: 10,
    images: [],
    slug: 'p2',
  } as unknown as Product;

  it('validates cart changes that happen during an ongoing validation', async () => {
    // 1. Initial cart
    localStorageMock.setItem(
      'baci-cart-guest',
      JSON.stringify([{ ...mockProduct1, cartItemId: 'p1' }])
    );

    let resolveFirstValidation: (value: any) => void = () => {
      // noop
    };
    (global.fetch as any).mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolveFirstValidation = resolve;
      });
    });
    // Second validation mock
    (global.fetch as any).mockImplementationOnce(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({ invalidProductIds: [], priceChanges: [] }),
      });
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    // Wait for hydration
    await act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.isHydrated).toBe(true);

    // Fast-forward to trigger first validation
    await act(() => {
      vi.advanceTimersByTime(600); // > 500ms debounce
    });

    // First validation should be in flight
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // 2. Modify cart WHILE validation is running
    await act(() => {
      result.current.addToCart(mockProduct2);
    });

    // Verify cart has 2 items
    expect(result.current.cart).toHaveLength(2);

    // 3. Complete first validation
    await act(() => {
      resolveFirstValidation({
        ok: true,
        json: async () => ({ invalidProductIds: [], priceChanges: [] }),
      });
    });

    // 4. Fast-forward time
    // The fix removes the lock, so the next validation should be triggered by debounce (500ms).
    // We advance by 1000ms to cover debounce.
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Expect a second validation call for the updated cart
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, 10000);
});
