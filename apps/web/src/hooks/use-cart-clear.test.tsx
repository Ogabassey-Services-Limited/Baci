import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

// Mock fetch
global.fetch = vi.fn();

describe('useCart - clearCart', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('preserves merchantSlug when clearing cart if initialized with one', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CartProvider merchantSlug="test-merchant">{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // Initial state check
    expect(result.current.merchantSlug).toBe('test-merchant');

    // Clear cart
    act(() => {
      result.current.clearCart();
    });

    // merchantSlug is preserved when clearCart is called with an initialMerchantSlug
    expect(result.current.merchantSlug).toBe('test-merchant');
  });
});
