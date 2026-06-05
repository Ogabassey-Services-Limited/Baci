import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { useCartCheckoutPrewarm } from './use-cart-checkout-prewarm';

const mockQueryClient = { prefetchQuery: jest.fn() };
const mockRouterPrefetch = jest.fn();
const mockWarmCheckoutEntry = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

jest.mock('expo-router', () => ({
  router: {
    prefetch: (...args: unknown[]) => mockRouterPrefetch(...args),
  },
}));

jest.mock('@/components/checkout/checkout-entry-prefetch', () => ({
  warmCheckoutEntry: (...args: unknown[]) => mockWarmCheckoutEntry(...args),
}));

describe('useCartCheckoutPrewarm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('warms checkout entry when a populated cart is ready', () => {
    renderHook(() =>
      useCartCheckoutPrewarm({
        enabled: true,
        itemCount: 1,
      })
    );

    expect(mockRouterPrefetch).toHaveBeenCalledWith('/checkout');
    expect(mockWarmCheckoutEntry).toHaveBeenCalledWith(mockQueryClient);
  });

  it('does not warm checkout entry for empty or unavailable carts', () => {
    renderHook(() =>
      useCartCheckoutPrewarm({
        enabled: false,
        itemCount: 1,
      })
    );
    renderHook(() =>
      useCartCheckoutPrewarm({
        enabled: true,
        itemCount: 0,
      })
    );

    expect(mockRouterPrefetch).not.toHaveBeenCalled();
    expect(mockWarmCheckoutEntry).not.toHaveBeenCalled();
  });

  it('returns an imperative prewarm handler for checkout press-in', () => {
    const { result } = renderHook(() =>
      useCartCheckoutPrewarm({
        enabled: false,
        itemCount: 0,
      })
    );

    result.current();

    expect(mockRouterPrefetch).toHaveBeenCalledWith('/checkout');
    expect(mockWarmCheckoutEntry).toHaveBeenCalledWith(mockQueryClient);
  });
});
