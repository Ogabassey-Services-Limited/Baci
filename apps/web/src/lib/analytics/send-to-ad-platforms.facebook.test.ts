import { describe, expect, it, vi } from 'vitest';
import type { ConversionEvent } from './ad-platform-conversion-event';

const mocks = vi.hoisted(() => ({ purchase: vi.fn() }));
vi.mock('@/lib/facebook-capi', () => ({
  facebookCAPI: { purchase: mocks.purchase },
  sendFacebookCAPIEvent: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));

import { normalizeEventType, sendToAdPlatforms } from './send-to-ad-platforms';

describe('send-to-ad-platforms facade exports', () => {
  it('retains event normalization and conversion types for existing callers', () => {
    const event: ConversionEvent = {
      custom_data: {},
      event_id: 'event-1',
      event_type: 'purchase',
      merchant_id: 'merchant-1',
      source: 'server',
      user_data: {},
    };
    expect(event.event_type).toBe('purchase');
    expect(normalizeEventType('START_CHECKOUT')).toBe('begin_checkout');
  });

  it('preserves limited data use through the Facebook facade dispatch', async () => {
    mocks.purchase.mockResolvedValue({ success: true });
    const event: ConversionEvent = {
      custom_data: {
        contents: [{ id: 'sku-1', price: 100, quantity: 1 }],
        order_id: 'order-1',
        value: 100,
      },
      event_id: 'event-1',
      event_type: 'purchase',
      limited_data_use: true,
      merchant_id: 'merchant-1',
      source: 'server',
      targets: ['facebook'],
      user_data: {},
    };

    await expect(
      sendToAdPlatforms(
        {
          facebook_capi_token: 'token',
          facebook_pixel_id: 'pixel',
          ga4_api_secret: null,
          google_analytics_id: null,
          offline_conversions_enabled: true,
          snapchat_capi_token: null,
          snapchat_pixel_id: null,
          tiktok_access_token: null,
          tiktok_pixel_id: null,
        },
        event
      )
    ).resolves.toEqual({ facebook: { success: true } });
    expect(mocks.purchase.mock.calls.at(-1)?.[9]).toBe(true);
  });
});
