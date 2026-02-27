import { act, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { type CartContextType, CartProvider, useCart } from './use-cart';

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
  onStateChange: (state: CartContextType) => void;
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

  const mockProduct2 = {
    id: 'prod-2',
    name: 'Test Product 2',
    price: 200,
    slug: 'test-product-2',
    images: [],
    description: '',
    category_id: 'cat-1',
    merchant_id: 'merch-1',
    created_at: '',
    updated_at: '',
    stock: 5,
    sku: 'SKU-2',
  } as unknown as Product;

  it('merges guest cart items into user cart upon login', async () => {
    let currentState: CartContextType | undefined;
    const handleStateChange = (state: CartContextType) => {
      currentState = state;
    };

    // 1. Initial render as Guest (userId: null)
    const { rerender } = render(
      <Wrapper userId={null}>
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    // Wait for hydration
    await waitFor(() => expect(currentState?.isHydrated).toBe(true));

    // 2. Add item as guest
    act(() => {
      currentState?.addToCart(mockProduct, 2);
    });

    // Verify item is in state
    expect(currentState?.cart).toHaveLength(1);
    expect(currentState?.cart[0].quantity).toBe(2);

    // Verify item is in guest storage
    const guestCart = localStorageMock.getItem('baci-cart-guest');
    expect(guestCart).toBeTruthy();
    if (guestCart) {
      expect(JSON.parse(guestCart)).toHaveLength(1);
    }

    // 3. Log in (change userId to 'user-1')
    rerender(
      <Wrapper userId="user-1">
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    // Wait for merge to complete
    await waitFor(() => {
      const userCart = localStorageMock.getItem('baci-cart-user-1');
      expect(userCart).toBeTruthy();
    });

    // 4. Verify item is preserved (merged)
    await waitFor(() => {
      expect(currentState?.cart).toHaveLength(1);
      expect(currentState?.cart[0].id).toBe('prod-1');
      expect(currentState?.cart[0].quantity).toBe(2);
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

  it('loads user cart unchanged when no guest cart exists', async () => {
    // Pre-seed user cart in storage
    const existingUserCart = [
      {
        ...mockProduct,
        cartItemId: 'prod-1',
        quantity: 3,
      },
    ];
    localStorageMock.setItem(
      'baci-cart-user-1',
      JSON.stringify(existingUserCart)
    );

    let currentState: CartContextType | undefined;
    const handleStateChange = (state: CartContextType) => {
      currentState = state;
    };

    // Start as guest
    const { rerender } = render(
      <Wrapper userId={null}>
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    await waitFor(() => expect(currentState?.isHydrated).toBe(true));

    // No guest items added -- transition to logged in
    rerender(
      <Wrapper userId="user-1">
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    // Verify user cart loads unchanged (no merge needed)
    await waitFor(() => {
      expect(currentState?.cart).toHaveLength(1);
      expect(currentState?.cart[0].id).toBe('prod-1');
      expect(currentState?.cart[0].quantity).toBe(3);
    });
  });

  it('sums quantities when items exist in both guest and user carts', async () => {
    // Pre-seed user cart with same product
    const existingUserCart = [
      {
        ...mockProduct,
        cartItemId: 'prod-1',
        quantity: 5,
      },
    ];
    localStorageMock.setItem(
      'baci-cart-user-1',
      JSON.stringify(existingUserCart)
    );

    let currentState: CartContextType | undefined;
    const handleStateChange = (state: CartContextType) => {
      currentState = state;
    };

    // Start as guest
    const { rerender } = render(
      <Wrapper userId={null}>
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    await waitFor(() => expect(currentState?.isHydrated).toBe(true));

    // Add same product as guest
    act(() => {
      currentState?.addToCart(mockProduct, 3);
    });

    expect(currentState?.cart).toHaveLength(1);
    expect(currentState?.cart[0].quantity).toBe(3);

    // Log in
    rerender(
      <Wrapper userId="user-1">
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    // Quantities should be summed: 5 (user) + 3 (guest) = 8
    await waitFor(() => {
      expect(currentState?.cart).toHaveLength(1);
      expect(currentState?.cart[0].id).toBe('prod-1');
      expect(currentState?.cart[0].quantity).toBe(8);
    });

    // Guest cart should be cleared
    expect(localStorageMock.getItem('baci-cart-guest')).toBeNull();
  });

  it('merges unique items from both guest and user carts', async () => {
    // Pre-seed user cart with product 2
    const existingUserCart = [
      {
        ...mockProduct2,
        cartItemId: 'prod-2',
        quantity: 1,
      },
    ];
    localStorageMock.setItem(
      'baci-cart-user-1',
      JSON.stringify(existingUserCart)
    );

    let currentState: CartContextType | undefined;
    const handleStateChange = (state: CartContextType) => {
      currentState = state;
    };

    // Start as guest
    const { rerender } = render(
      <Wrapper userId={null}>
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    await waitFor(() => expect(currentState?.isHydrated).toBe(true));

    // Add product 1 as guest
    act(() => {
      currentState?.addToCart(mockProduct, 2);
    });

    // Log in
    rerender(
      <Wrapper userId="user-1">
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    // Both products should be in merged cart
    await waitFor(() => {
      expect(currentState?.cart).toHaveLength(2);
    });

    const prod1 = currentState?.cart.find((item) => item.id === 'prod-1');
    const prod2 = currentState?.cart.find((item) => item.id === 'prod-2');
    expect(prod1?.quantity).toBe(2);
    expect(prod2?.quantity).toBe(1);
  });

  it('handles corrupted localStorage data gracefully', async () => {
    // Seed corrupted data in guest cart
    localStorageMock.setItem('baci-cart-guest', '{invalid json!!!');

    let currentState: CartContextType | undefined;
    const handleStateChange = (state: CartContextType) => {
      currentState = state;
    };

    // Start as guest
    const { rerender } = render(
      <Wrapper userId={null}>
        <TestConsumer onStateChange={handleStateChange} />
      </Wrapper>
    );

    await waitFor(() => expect(currentState?.isHydrated).toBe(true));

    // Log in -- should not throw
    expect(() => {
      rerender(
        <Wrapper userId="user-1">
          <TestConsumer onStateChange={handleStateChange} />
        </Wrapper>
      );
    }).not.toThrow();

    // Cart should be empty (corrupted data is discarded by getCartFromStorage)
    await waitFor(() => {
      expect(currentState?.cart).toHaveLength(0);
    });
  });
});
