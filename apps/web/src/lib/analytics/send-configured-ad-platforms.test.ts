import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsPlatformConfig } from './analytics-platform-config-types';

const mocks = vi.hoisted(() => ({
  facebook: vi.fn(),
  loggerInfo: vi.fn(),
  snapchat: vi.fn(),
  tiktok: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo },
}));
vi.mock('./send-facebook-ad-platform-event', () => ({
  sendFacebookAdPlatformEvent: mocks.facebook,
}));
vi.mock('./send-snapchat-ad-platform-event', () => ({
  sendSnapchatAdPlatformEvent: mocks.snapchat,
}));
vi.mock('./send-tiktok-ad-platform-event', () => ({
  sendTikTokAdPlatformEvent: mocks.tiktok,
}));

import { sendConfiguredAdPlatforms } from './send-configured-ad-platforms';

describe('sendConfiguredAdPlatforms', () => {
  beforeEach(() => vi.clearAllMocks());

  const config: Readonly<AnalyticsPlatformConfig> = Object.freeze({
    facebook_capi_token: 'fb-token',
    facebook_pixel_id: 'fb-pixel',
    ga4_api_secret: null,
    google_analytics_id: null,
    offline_conversions_enabled: true,
    snapchat_capi_token: 'snap-token',
    snapchat_pixel_id: 'snap-pixel',
    tiktok_access_token: 'tt-token',
    tiktok_pixel_id: 'tt-pixel',
  });

  it('uses supplied immutable config and exactly one selected provider', async () => {
    mocks.facebook.mockResolvedValue({ success: true });

    await expect(
      sendConfiguredAdPlatforms(config, {
        custom_data: {},
        event_id: 'event-1',
        event_type: 'purchase',
        merchant_id: 'merchant-1',
        source: 'server',
        targets: ['facebook'],
        user_data: {},
      })
    ).resolves.toEqual({ facebook: { success: true } });
    expect(mocks.facebook).toHaveBeenCalledTimes(1);
    expect(mocks.facebook).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ event_id: 'event-1' }),
      'Purchase',
      undefined
    );
  });

  it('isolates provider failures with allSettled result semantics', async () => {
    mocks.facebook.mockResolvedValue({ success: true });
    mocks.tiktok.mockRejectedValue(new Error('provider unavailable'));
    mocks.snapchat.mockResolvedValue({ error: 'rejected', success: false });

    await expect(
      sendConfiguredAdPlatforms(config, {
        custom_data: { contents: [{ id: 'sku-1', quantity: 1 }], value: 100 },
        event_id: 'event-all',
        event_type: 'purchase',
        merchant_id: 'merchant-1',
        source: 'server',
        user_data: {},
      })
    ).resolves.toEqual({
      facebook: { success: true },
      snapchat: { error: 'rejected', success: false },
      tiktok: { error: 'unhandled_error', success: false },
    });
    expect(mocks.facebook).toHaveBeenCalledTimes(1);
    expect(mocks.tiktok).toHaveBeenCalledTimes(1);
    expect(mocks.snapchat).toHaveBeenCalledTimes(1);
  });

  it('redacts configured credential values from results and logs', async () => {
    mocks.facebook.mockResolvedValue({
      error: `vendor echoed ${config.facebook_capi_token} and ${config.facebook_pixel_id}, authorization: Bearer shadow-token, retryable=true`,
      providerPayload: { access_token: config.facebook_capi_token },
      success: false,
    });

    const result = await sendConfiguredAdPlatforms(config, {
      custom_data: {},
      event_id: 'credential-redaction',
      event_type: 'purchase',
      merchant_id: 'merchant-1',
      source: 'server',
      targets: ['facebook'],
      user_data: {},
    });
    const observableOutput = JSON.stringify({
      logs: mocks.loggerInfo.mock.calls,
      result,
    });

    expect(result).toEqual({
      facebook: {
        error:
          'vendor echoed [redacted] and [redacted], authorization=[redacted], retryable=true',
        success: false,
      },
    });
    expect(observableOutput).not.toContain('fb-token');
    expect(observableOutput).not.toContain('fb-pixel');
  });

  it('projects provider results and redacts every configured string value', async () => {
    const oneCharacterConfig = {
      ...config,
      facebook_capi_token: 'x',
      facebook_pixel_id: 'pixel-1',
    };
    mocks.facebook.mockResolvedValue({
      error: 'x pixel-1',
      providerPayload: { secret: 'x' },
      success: false,
    });

    const result = await sendConfiguredAdPlatforms(oneCharacterConfig, {
      custom_data: {},
      event_id: 'pixel-1',
      event_type: 'purchase',
      merchant_id: 'merchant-1',
      source: 'server',
      targets: ['facebook'],
      user_data: {},
    });
    const observable = JSON.stringify({
      logs: mocks.loggerInfo.mock.calls,
      result,
    });

    expect(result).toEqual({
      facebook: {
        error: '[redacted] [redacted]',
        success: false,
      },
    });
    expect(observable).not.toContain('providerPayload');
    expect(observable).not.toContain('pixel-1');
    expect(observable).not.toContain('"x"');
  });

  it('preserves a validated numeric HTTP status while dropping unknown data', async () => {
    mocks.facebook.mockResolvedValue({
      error: 'rate limited',
      httpStatus: 429,
      response: { access_token: config.facebook_capi_token },
      success: false,
    });

    const result = await sendConfiguredAdPlatforms(config, {
      custom_data: {},
      event_id: 'http-status-projection',
      event_type: 'purchase',
      merchant_id: 'merchant-1',
      source: 'server',
      targets: ['facebook'],
      user_data: {},
    });

    expect(result).toEqual({
      facebook: {
        error: 'rate limited',
        httpStatus: 429,
        success: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('response');
    expect(JSON.stringify(result)).not.toContain('fb-token');
  });

  it('redacts an encoded configured value from aggregate errors and logs', async () => {
    const accessToken = 'api secret/?&="\\path';
    const encodedAccessToken = encodeURIComponent(accessToken);
    const encodedConfig = { ...config, facebook_capi_token: accessToken };
    mocks.facebook.mockResolvedValue({
      error: `provider echoed ${encodedAccessToken}`,
      success: false,
    });

    const result = await sendConfiguredAdPlatforms(encodedConfig, {
      custom_data: {},
      event_id: 'encoded-aggregate',
      event_type: 'purchase',
      merchant_id: 'merchant-1',
      source: 'server',
      targets: ['facebook'],
      user_data: {},
    });
    const observable = JSON.stringify({
      logs: mocks.loggerInfo.mock.calls,
      result,
    });

    expect(result).toEqual({
      facebook: {
        error: 'provider echoed [redacted]',
        success: false,
      },
    });
    expect(observable).not.toContain(encodedAccessToken);
    expect(observable).not.toContain(accessToken);
  });

  it('skips disabled or unmapped fanout without provider calls', async () => {
    const disabled = { ...config, offline_conversions_enabled: false };
    await expect(
      sendConfiguredAdPlatforms(disabled, {
        custom_data: {},
        event_id: 'disabled',
        event_type: 'purchase',
        merchant_id: 'merchant-1',
        source: 'server',
        user_data: {},
      })
    ).resolves.toEqual({});
    await expect(
      sendConfiguredAdPlatforms(config, {
        custom_data: {},
        event_id: 'unmapped',
        event_type: 'page_view',
        merchant_id: 'merchant-1',
        source: 'server',
        user_data: {},
      })
    ).resolves.toEqual({});
    expect(mocks.facebook).not.toHaveBeenCalled();
    expect(mocks.tiktok).not.toHaveBeenCalled();
    expect(mocks.snapchat).not.toHaveBeenCalled();
  });

  it('delivers four single-target rows with four calls, not sixteen', async () => {
    mocks.facebook.mockResolvedValue({ success: true });
    mocks.tiktok.mockResolvedValue({ success: true });
    mocks.snapchat.mockResolvedValue({ success: true });
    const targets = ['facebook', 'tiktok', 'snapchat', 'facebook'] as const;

    await Promise.all(
      targets.map((target, index) =>
        sendConfiguredAdPlatforms(config, {
          custom_data: {},
          event_id: `event-${index}`,
          event_type: 'purchase',
          merchant_id: 'merchant-1',
          source: 'server',
          targets: [target],
          user_data: {},
        })
      )
    );

    expect(mocks.facebook).toHaveBeenCalledTimes(2);
    expect(mocks.tiktok).toHaveBeenCalledTimes(1);
    expect(mocks.snapchat).toHaveBeenCalledTimes(1);
  });
});
