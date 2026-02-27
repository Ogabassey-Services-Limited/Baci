import { act, render, waitFor } from '@testing-library/react';
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

// Helper component to consume cart context
const TestConsumer = ({
  onStateChange,
}: {
  onStateChange: (state: any) => void;
}) => {
  const cartState = useCart();
  onStateChange(cartState);
  return null;
};

// Wrapper component to handle prop updates
const Wrapper = ({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) => <CartProvider userId={userId}>{children}</CartProvider>;

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
    let currentState: any;
    const handleStateChange = (state: any) => {
      currentState = state;
    };

    // 1. Initial render as Guest (userId: null)
    const { rerender } = render(
      <Wrapper userId={null}>
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    // Wait for hydration
    await waitFor(() => expect(currentState.isHydrated).toBe(true));

    // 2. Add item as guest
    act(() => {
      currentState.addToCart(mockProduct, 2);
    });

    // Verify item is in state
    expect(currentState.cart).toHaveLength(1);
    expect(currentState.cart[0].quantity).toBe(2);

    // Verify item is in guest storage
    const guestCart = localStorageMock.getItem('baci-cart-guest');
    expect(guestCart).toBeTruthy();
    if (guestCart) {
      expect(JSON.parse(guestCart)).toHaveLength(1);
    }

    // 3. Log in (change userId to 'user-1')
    // We update the props by re-rendering the same component tree with new props
    rerender(
      <Wrapper userId="user-1">
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    // Wait for effect to run (hydration/merge)
    // We check for user cart storage existence as a signal that merge happened
    await waitFor(() => {
      const userCart = localStorageMock.getItem('baci-cart-user-1');
      expect(userCart).toBeTruthy();
    });

    // 4. Verify item is preserved (merged)
    // Need to wait for state update to propagate
    await waitFor(() => {
      expect(currentState.cart).toHaveLength(1);
      expect(currentState.cart[0].id).toBe('prod-1');
      expect(currentState.cart[0].quantity).toBe(2);
    });

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
