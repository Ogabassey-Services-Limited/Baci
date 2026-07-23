import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ addToCart: vi.fn() }));
vi.mock('@/lib/snapchat-capi', () => ({
  sendSnapchatEvent: vi.fn(),
  snapchatCAPI: { addToCart: mocks.addToCart },
}));

import { sendSnapchatAdPlatformEvent } from './send-snapchat-ad-platform-event';

describe('sendSnapchatAdPlatformEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the persisted occurrence time for add-to-cart delivery', async () => {
    mocks.addToCart.mockResolvedValue({ success: true });
    await sendSnapchatAdPlatformEvent(
      {
        facebook_capi_token: null,
        facebook_pixel_id: null,
        ga4_api_secret: null,
        google_analytics_id: null,
        offline_conversions_enabled: true,
        snapchat_capi_token: 'token',
        snapchat_pixel_id: 'pixel',
        tiktok_access_token: null,
        tiktok_pixel_id: null,
      },
      {
        custom_data: {
          contents: [{ id: 'sku-1', quantity: 1 }],
          value: 100,
        },
        event_id: 'event-1',
        event_type: 'add_to_cart',
        merchant_id: 'merchant-1',
        occurred_at: '2026-07-12T12:00:00.000Z',
        source: 'server',
        user_data: {},
      },
      'ADD_CART'
    );
    expect(mocks.addToCart).toHaveBeenCalledWith(
      'pixel',
      'token',
      expect.any(Object),
      'sku-1',
      100,
      'NGN',
      'event-1',
      undefined,
      1_783_857_600
    );
  });

  it('fails closed without credentials', async () => {
    await expect(
      sendSnapchatAdPlatformEvent(
        {
          facebook_capi_token: null,
          facebook_pixel_id: null,
          ga4_api_secret: null,
          google_analytics_id: null,
          offline_conversions_enabled: true,
          snapchat_capi_token: null,
          snapchat_pixel_id: null,
          tiktok_access_token: null,
          tiktok_pixel_id: null,
        },
        {
          custom_data: {},
          event_id: 'event-1',
          event_type: 'add_to_cart',
          merchant_id: 'merchant-1',
          source: 'server',
          user_data: {},
        },
        'ADD_CART'
      )
    ).resolves.toEqual({ error: 'not_configured', success: false });
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });
});
