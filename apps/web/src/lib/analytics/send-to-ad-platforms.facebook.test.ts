import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateClient,
  mockFacebookAddToCart,
  mockFacebookEvent,
  mockFacebookInitiateCheckout,
  mockFacebookPurchase,
  mockFacebookViewContent,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockFacebookAddToCart: vi.fn(),
  mockFacebookEvent: vi.fn(),
  mockFacebookInitiateCheckout: vi.fn(),
  mockFacebookPurchase: vi.fn(),
  mockFacebookViewContent: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/facebook-capi', () => ({
  facebookCAPI: {
    addToCart: (...args: unknown[]) => mockFacebookAddToCart(...args),
    initiateCheckout: (...args: unknown[]) =>
      mockFacebookInitiateCheckout(...args),
    purchase: (...args: unknown[]) => mockFacebookPurchase(...args),
    viewContent: (...args: unknown[]) => mockFacebookViewContent(...args),
  },
  sendFacebookCAPIEvent: (...args: unknown[]) => mockFacebookEvent(...args),
}));

import { sendToAdPlatforms } from './send-to-ad-platforms';

function createQuery(table: string) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => ({
      data:
        table === 'merchants'
          ? {
              offline_conversions_enabled: true,
              plan_expires_at: null,
              plan_tier: 'pro',
              premium_features: [],
            }
          : {
              facebook_capi_token: 'fb-token',
              facebook_pixel_id: 'fb-pixel',
            },
      error: null,
    })),
    select: vi.fn(() => query),
  };

  return query;
}

describe('sendToAdPlatforms Facebook LDU', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => createQuery(table)),
    });
    for (const mock of [
      mockFacebookAddToCart,
      mockFacebookEvent,
      mockFacebookInitiateCheckout,
      mockFacebookPurchase,
      mockFacebookViewContent,
    ]) {
      mock.mockResolvedValue({ success: true });
    }
  });

  it('propagates limited_data_use through every Facebook dispatch branch', async () => {
    const event = (event_type: string) => ({
      merchant_id: 'merchant-1',
      event_id: `evt-${event_type}`,
      event_type,
      limited_data_use: true,
      user_data: {},
      custom_data: {
        contents: [{ id: 'sku-1', name: 'Product', price: 100, quantity: 1 }],
        currency: 'NGN',
        order_id: 'order-1',
        search_string: 'product',
        value: 100,
      },
      source: 'server' as const,
      targets: ['facebook' as const],
    });

    await sendToAdPlatforms(event('purchase'));
    await sendToAdPlatforms(event('begin_checkout'));
    await sendToAdPlatforms(event('add_to_cart'));
    await sendToAdPlatforms(event('product_view'));
    await sendToAdPlatforms(event('search'));
    await sendToAdPlatforms(event('add_payment_info'));

    expect(mockFacebookPurchase).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'order-1',
      100,
      'NGN',
      expect.anything(),
      undefined,
      'evt-purchase',
      true,
      undefined,
      undefined
    );
    expect(mockFacebookInitiateCheckout).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      100,
      'NGN',
      expect.anything(),
      undefined,
      'evt-begin_checkout',
      undefined,
      undefined,
      true
    );
    expect(mockFacebookAddToCart).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'sku-1',
      'Product',
      100,
      'NGN',
      undefined,
      'evt-add_to_cart',
      undefined,
      undefined,
      true
    );
    expect(mockFacebookViewContent).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'sku-1',
      'Product',
      100,
      'NGN',
      undefined,
      undefined,
      'evt-product_view',
      undefined,
      undefined,
      true
    );
    expect(mockFacebookEvent).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.anything(),
      'Search',
      expect.anything(),
      expect.anything(),
      undefined,
      'evt-search',
      true,
      undefined,
      undefined
    );
    expect(mockFacebookEvent).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.anything(),
      'AddPaymentInfo',
      expect.anything(),
      expect.anything(),
      undefined,
      'evt-add_payment_info',
      true,
      undefined,
      undefined
    );
  });
});
