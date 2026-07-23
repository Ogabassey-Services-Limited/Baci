import { describe, expect, it } from 'vitest';
import { hasConfiguredAnalyticsPlatform } from './has-configured-analytics-platform';

describe('hasConfiguredAnalyticsPlatform', () => {
  it('requires a complete credential pair', () => {
    const base = {
      facebook_capi_token: null,
      facebook_pixel_id: null,
      ga4_api_secret: null,
      google_analytics_id: null,
      offline_conversions_enabled: true,
      snapchat_capi_token: null,
      snapchat_pixel_id: null,
      tiktok_access_token: null,
      tiktok_pixel_id: null,
    };
    expect(
      hasConfiguredAnalyticsPlatform({
        ...base,
        facebook_capi_token: 'token',
        facebook_pixel_id: 'pixel',
      })
    ).toBe(true);
    expect(
      hasConfiguredAnalyticsPlatform({
        ...base,
        facebook_capi_token: 'token',
      })
    ).toBe(false);
  });
});
