import { describe, expect, it } from 'vitest';
import { mergeAnalyticsPlatformConfig } from './merge-analytics-platform-config';

describe('mergeAnalyticsPlatformConfig', () => {
  it('prefers trimmed feature settings and falls back to merchant credentials', () => {
    expect(
      mergeAnalyticsPlatformConfig(
        {
          offline_conversions_enabled: true,
          facebook_capi_token: 'merchant-token',
          facebook_pixel_id: 'merchant-pixel',
        },
        { facebook_capi_token: ' feature-token ', facebook_pixel_id: '   ' }
      )
    ).toMatchObject({
      facebook_capi_token: 'feature-token',
      facebook_pixel_id: 'merchant-pixel',
      offline_conversions_enabled: true,
    });
  });
});
