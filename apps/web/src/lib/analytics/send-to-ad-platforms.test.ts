import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ configured: vi.fn() }));
vi.mock('./send-configured-ad-platforms', () => ({
  sendConfiguredAdPlatforms: mocks.configured,
}));

import { sendToAdPlatforms } from './send-to-ad-platforms';

const config = Object.freeze({
  facebook_capi_token: 'token',
  facebook_pixel_id: 'pixel',
  ga4_api_secret: null,
  google_analytics_id: null,
  offline_conversions_enabled: true,
  snapchat_capi_token: null,
  snapchat_pixel_id: null,
  tiktok_access_token: null,
  tiktok_pixel_id: null,
});
const event = {
  custom_data: {},
  event_id: 'event-1',
  event_type: 'purchase',
  merchant_id: 'merchant-1',
  source: 'server' as const,
  user_data: {},
};

describe('sendToAdPlatforms compatibility facade', () => {
  it('delegates supplied configuration without constructing a database client', async () => {
    mocks.configured.mockResolvedValue({ facebook: { success: true } });

    await expect(sendToAdPlatforms(config, event)).resolves.toEqual({
      facebook: { success: true },
    });
    expect(mocks.configured).toHaveBeenCalledWith(config, event, undefined);
  });

  it('propagates provider dispatch failures unchanged', async () => {
    const failure = new Error('provider unavailable');
    mocks.configured.mockRejectedValueOnce(failure);
    await expect(sendToAdPlatforms(config, event)).rejects.toBe(failure);
  });

  it('forwards privacy mode and cancellation options unchanged', async () => {
    const controller = new AbortController();
    const privacyEvent = { ...event, limited_data_use: true };
    const options = { signal: controller.signal };
    mocks.configured.mockResolvedValue({ facebook: { success: true } });

    await sendToAdPlatforms(config, privacyEvent, options);

    expect(mocks.configured).toHaveBeenCalledWith(
      config,
      privacyEvent,
      options
    );
  });
});
