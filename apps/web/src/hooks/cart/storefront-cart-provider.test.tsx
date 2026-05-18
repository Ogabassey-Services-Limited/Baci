import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCart } from './cart-context';
import { StorefrontCartProvider } from './storefront-cart-provider';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

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

global.fetch = vi.fn();

describe('StorefrontCartProvider', () => {
  const mockProduct = {
    id: 'prod-1',
    merchant_id: 'merch-1',
    name: 'Test Product',
    description: '',
    status: 'active' as const,
    price: 100,
    manage_stock: true,
    stock: 10,
    image: '',
    imageLarge: '',
    imageHint: '',
    brand: 'Test Brand',
    gtin: '',
    mpn: '',
    slug: 'test-product',
    images: [],
    category_id: 'cat-1',
    sku: 'SKU-1',
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates from the existing merchant cart storage key and supports addToCart', async () => {
    localStorageMock.setItem(
      'baci-cart-ogabassey-guest',
      JSON.stringify([{ ...mockProduct, quantity: 1, cartItemId: 'prod-1' }])
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <StorefrontCartProvider merchantSlug="ogabassey">
        {children}
      </StorefrontCartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.totalItems).toBe(1);

    act(() => {
      result.current.addToCart(mockProduct, 1);
    });

    expect(result.current.totalItems).toBe(2);
    expect(result.current.cart[0]?.id).toBe('prod-1');
  });

  it('defers validation until interaction when requested', async () => {
    vi.useFakeTimers();

    localStorageMock.setItem(
      'baci-cart-ogabassey-guest',
      JSON.stringify([{ ...mockProduct, quantity: 1, cartItemId: 'prod-1' }])
    );

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        invalidProductIds: [],
        priceChanges: [],
      }),
    } as Response);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <StorefrontCartProvider
        merchantSlug="ogabassey"
        deferValidationUntilIdle
        validationActivationTimeoutMs={5_000}
      >
        {children}
      </StorefrontCartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isHydrated).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
      await Promise.resolve();
    });

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('stores the default SKU-matrix variant identity, attributes, and condition for quick add flows', async () => {
    const skuMatrixProduct = {
      ...mockProduct,
      id: 'iphone-15',
      has_variants: true,
      manage_stock: true,
      price: 900000,
      variants: [
        {
          id: 'iphone15-openbox-128-black-esim',
          product_id: 'iphone-15',
          merchant_id: 'merch-1',
          condition: 'open_box' as const,
          attributes: {
            color: 'Black',
            sim_type: 'eSIM Only',
            storage: '128GB',
          },
          price_override: 829000,
          stock_quantity: 3,
        },
      ],
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <StorefrontCartProvider merchantSlug="ogabassey">
        {children}
      </StorefrontCartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      result.current.addToCart(skuMatrixProduct, 1);
    });

    expect(result.current.cart[0]).toMatchObject({
      id: 'iphone-15',
      condition: 'open_box',
      price: 829000,
      selectedColor: 'Black',
      selectedStorage: '128GB',
      variantAttributes: {
        color: 'Black',
        sim_type: 'eSIM Only',
        storage: '128GB',
      },
      variantId: 'iphone15-openbox-128-black-esim',
    });
  });
});
