import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useMerchantFeatures,
  useStorefrontFeatures,
} from './use-merchant-features';

describe('useStorefrontFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns defaults when no merchantId or slug', () => {
    const { result } = renderHook(() => useStorefrontFeatures({}));
    expect(result.current.features.reviewsEnabled).toBe(true);
    expect(result.current.features.loyaltyEnabled).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches features when merchantId is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          loyaltyEnabled: true,
          reviewsEnabled: false,
          wishlistEnabled: true,
          orderTrackingEnabled: true,
          discountCodesEnabled: true,
          guestCheckoutEnabled: true,
          shippingProviders: ['gigl'],
          freeShippingThreshold: 5000,
          collectPhone: true,
          requireAccount: false,
          showOrderNotes: true,
          pages: {
            about: true,
            contact: true,
            faq: true,
            privacy: true,
            terms: true,
            rewards: true,
          },
          showRecentPurchases: false,
          showStockLevels: true,
          lowStockThreshold: 10,
          hasGoogleAnalytics: false,
          hasFacebookPixel: false,
          hasTiktokPixel: false,
        }),
    } as Response);

    const { result } = renderHook(() =>
      useStorefrontFeatures({ merchantId: 'merchant-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isLoyaltyEnabled).toBe(true);
  });
});

describe('useMerchantFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches merchant feature settings', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'feat-1',
          merchant_id: 'm-1',
          loyalty_enabled: true,
          reviews_enabled: true,
          blog_enabled: false,
        }),
    } as Response);

    const { result } = renderHook(() => useMerchantFeatures());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.loyaltyEnabled).toBe(true);
  });

  it('handles fetch error', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      redirected: false,
      type: 'basic' as ResponseType,
      url: '',
      clone: vi.fn(),
      body: null,
      bodyUsed: false,
      arrayBuffer: vi.fn(),
      blob: vi.fn(),
      formData: vi.fn(),
      text: vi.fn(),
      json: vi.fn(() => Promise.resolve({ error: 'Unauthorized' })),
    } as unknown as Response;

    // Mock multiple times since fetchSettings may be called more than once due to dependency array
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMerchantFeatures());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe('Unauthorized');
  });
});
