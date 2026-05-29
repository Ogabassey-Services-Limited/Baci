import { describe, expect, it, vi } from 'vitest';
import {
  fetchAnalyticsPlatformConfig,
  mergeAnalyticsPlatformConfig,
} from './analytics-platform-config';

const emptyConfig = {
  offline_conversions_enabled: null,
  facebook_pixel_id: null,
  facebook_capi_token: null,
  tiktok_pixel_id: null,
  tiktok_access_token: null,
  google_analytics_id: null,
  ga4_api_secret: null,
  snapchat_pixel_id: null,
  snapchat_capi_token: null,
};

describe('mergeAnalyticsPlatformConfig', () => {
  it('prefers dashboard feature settings and falls back to merchant columns', () => {
    const merged = mergeAnalyticsPlatformConfig(
      {
        ...emptyConfig,
        offline_conversions_enabled: true,
        facebook_pixel_id: 'fb-legacy-pixel',
        facebook_capi_token: 'fb-legacy-token',
        google_analytics_id: 'G-LEGACY',
        ga4_api_secret: 'ga4-legacy',
      },
      {
        ...emptyConfig,
        facebook_pixel_id: ' fb-feature-pixel ',
        facebook_capi_token: ' fb-feature-token ',
        tiktok_pixel_id: 'tt-feature-pixel',
        tiktok_access_token: 'tt-feature-token',
        google_analytics_id: '',
        ga4_api_secret: '   ',
        snapchat_pixel_id: 'snap-feature-pixel',
        snapchat_capi_token: 'snap-feature-token',
      }
    );

    expect(merged).toEqual({
      offline_conversions_enabled: true,
      facebook_pixel_id: 'fb-feature-pixel',
      facebook_capi_token: 'fb-feature-token',
      tiktok_pixel_id: 'tt-feature-pixel',
      tiktok_access_token: 'tt-feature-token',
      google_analytics_id: 'G-LEGACY',
      ga4_api_secret: 'ga4-legacy',
      snapchat_pixel_id: 'snap-feature-pixel',
      snapchat_capi_token: 'snap-feature-token',
    });
  });
});

describe('fetchAnalyticsPlatformConfig', () => {
  it('loads merchant and feature settings before merging platform credentials', async () => {
    const from = vi.fn((table: string) => {
      const query = {
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(() => {
          if (table === 'merchants') {
            return {
              data: {
                ...emptyConfig,
                offline_conversions_enabled: true,
                facebook_pixel_id: 'fb-legacy-pixel',
                facebook_capi_token: 'fb-legacy-token',
              },
              error: null,
            };
          }

          return {
            data: {
              ...emptyConfig,
              facebook_pixel_id: 'fb-feature-pixel',
              facebook_capi_token: 'fb-feature-token',
              tiktok_pixel_id: 'tt-feature-pixel',
              tiktok_access_token: 'tt-feature-token',
            },
            error: null,
          };
        }),
        select: vi.fn(() => query),
      };

      return query;
    });

    const result = await fetchAnalyticsPlatformConfig(
      { from } as never,
      'merchant-1'
    );

    expect(from).toHaveBeenCalledWith('merchants');
    expect(from).toHaveBeenCalledWith('merchant_feature_settings');
    expect(result).toMatchObject({
      facebook_pixel_id: 'fb-feature-pixel',
      facebook_capi_token: 'fb-feature-token',
      tiktok_pixel_id: 'tt-feature-pixel',
      tiktok_access_token: 'tt-feature-token',
    });
  });
});
