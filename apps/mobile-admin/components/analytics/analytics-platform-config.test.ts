import { describe, expect, it } from 'vitest';
import { analyticsPlatformConfigs } from './analytics-platform-config';

describe('analyticsPlatformConfigs', () => {
  it('keeps every provider credential and help link in the extracted section contract', () => {
    expect(analyticsPlatformConfigs).toEqual([
      expect.objectContaining({
        id: 'facebook',
        fields: [
          expect.objectContaining({ field: 'facebook_pixel_id' }),
          expect.objectContaining({ field: 'facebook_capi_token' }),
        ],
      }),
      expect.objectContaining({
        id: 'tiktok',
        fields: [
          expect.objectContaining({ field: 'tiktok_pixel_id' }),
          expect.objectContaining({ field: 'tiktok_access_token' }),
        ],
      }),
      expect.objectContaining({
        id: 'google',
        fields: [
          expect.objectContaining({ field: 'google_analytics_id' }),
          expect.objectContaining({ field: 'ga4_api_secret' }),
        ],
      }),
      expect.objectContaining({
        id: 'snapchat',
        fields: [
          expect.objectContaining({ field: 'snapchat_pixel_id' }),
          expect.objectContaining({ field: 'snapchat_capi_token' }),
        ],
      }),
    ]);

    for (const platform of analyticsPlatformConfigs) {
      expect(platform.helpLink).toMatch(/^https:\/\//);
    }
  });
});
