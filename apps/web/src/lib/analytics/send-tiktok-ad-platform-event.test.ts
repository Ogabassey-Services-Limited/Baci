import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ addToCart: vi.fn() }));
vi.mock('@/lib/tiktok-events-api', () => ({
  tiktokEventsAPI: { addToCart: mocks.addToCart },
}));

import { sendTikTokAdPlatformEvent } from './send-tiktok-ad-platform-event';

describe('sendTikTokAdPlatformEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends enhanced add-to-cart properties with stable event identity', async () => {
    mocks.addToCart.mockResolvedValue({ success: true });
    const signal = new AbortController().signal;
    await sendTikTokAdPlatformEvent(
      {
        facebook_capi_token: null,
        facebook_pixel_id: null,
        ga4_api_secret: null,
        google_analytics_id: null,
        offline_conversions_enabled: true,
        snapchat_capi_token: null,
        snapchat_pixel_id: null,
        tiktok_access_token: 'token',
        tiktok_pixel_id: 'pixel',
      },
      {
        custom_data: {
          contents: [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 1 }],
          currency: 'NGN',
          value: 100,
        },
        event_id: 'event-1',
        event_type: 'add_to_cart',
        merchant_id: 'merchant-1',
        occurred_at: '2026-07-12T12:00:00.000Z',
        source: 'server',
        user_data: { email: 'buyer@example.com' },
      },
      'AddToCart',
      signal
    );
    expect(mocks.addToCart).toHaveBeenCalledWith(
      'pixel',
      'token',
      expect.objectContaining({ email: 'buyer@example.com' }),
      expect.objectContaining({ contentId: 'sku-1', value: 100 }),
      expect.objectContaining({ eventId: 'event-1' }),
      signal
    );
  });

  it('fails closed without credentials', async () => {
    await expect(
      sendTikTokAdPlatformEvent(
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
        'AddToCart'
      )
    ).resolves.toEqual({ error: 'not_configured', success: false });
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });
});
