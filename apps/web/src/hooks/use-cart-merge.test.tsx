import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { CartProvider, useCart } from './use-cart';

// Mock logger
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

// Mock fetch for validation
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ invalidProductIds: [], priceChanges: [] }),
});

describe('useCart - Merge Guest Cart on Login', () => {
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
  } as unknown as Product;

  it('merges guest cart items into user cart upon login', async () => {
    // 1. Render hook with initial userId = null (Guest)
    const { result, rerender } = renderHook(
      // biome-ignore lint/suspicious/noExplicitAny: internal testing hook
      ({ userId }: { userId: string | null }) => useCart(),
      {
        initialProps: { userId: null as string | null },
        wrapper: ({
          children,
          userId,
        }: {
          children: ReactNode;
          userId?: string | null;
        }) => <CartProvider userId={userId}>{children}</CartProvider>,
      }
    );

    // Wait for hydration
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // 2. Add item as guest
    await act(async () => {
      result.current.addToCart(mockProduct, 2);
    });

    // Verify item is in state
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);

    // Verify item is in guest storage
    const guestCart = localStorageMock.getItem('baci-cart-guest');
    expect(guestCart).toBeTruthy();
    if (guestCart) {
      expect(JSON.parse(guestCart)).toHaveLength(1);
    }

    // 3. Log in (change userId to 'user-1')
    // We update the props passed to the hook, which flow into the wrapper
    rerender({ userId: 'user-1' });

    // Wait for effect to run (hydration/merge)
    // We check for user cart storage existence as a signal that merge happened
    await waitFor(() => {
      const userCart = localStorageMock.getItem('baci-cart-user-1');
      expect(userCart).toBeTruthy();
    });

    // 4. Verify item is preserved (merged)
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].id).toBe('prod-1');
    expect(result.current.cart[0].quantity).toBe(2);

    // Verify user storage has the item
    const userCart = localStorageMock.getItem('baci-cart-user-1');
    expect(userCart).toBeTruthy();
    if (userCart) {
      expect(JSON.parse(userCart)).toHaveLength(1);
    }

    // Verify guest storage is cleared
    const guestCartAfter = localStorageMock.getItem('baci-cart-guest');
    expect(guestCartAfter).toBeNull();
  });
});
