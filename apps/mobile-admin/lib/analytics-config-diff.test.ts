import { describe, expect, it } from 'vitest';
import {
  type AnalyticsState,
  buildAnalyticsDiff,
} from './analytics-config-diff';

const seededState: AnalyticsState = {
  facebook_capi_token: '',
  facebook_pixel_id: '',
  ga4_api_secret: '',
  google_analytics_id: '',
  offline_conversions_enabled: true,
  snapchat_capi_token: '',
  snapchat_pixel_id: '',
  tiktok_access_token: '',
  tiktok_pixel_id: '',
};

describe('buildAnalyticsDiff', () => {
  it('returns only the fields that changed versus the seeded baseline', () => {
    const current: AnalyticsState = {
      ...seededState,
      facebook_pixel_id: 'fb-123',
      offline_conversions_enabled: false,
    };

    expect(buildAnalyticsDiff(current, seededState)).toEqual({
      facebook_pixel_id: 'fb-123',
      offline_conversions_enabled: false,
    });
  });

  it('returns an empty diff when nothing changed', () => {
    expect(buildAnalyticsDiff({ ...seededState }, seededState)).toEqual({});
  });

  it('persists a cleared string field as null, not empty string', () => {
    const baseline: AnalyticsState = {
      ...seededState,
      ga4_api_secret: 'secret',
    };
    const current: AnalyticsState = { ...baseline, ga4_api_secret: '' };

    expect(buildAnalyticsDiff(current, baseline)).toEqual({
      ga4_api_secret: null,
    });
  });

  it('writes every field when there is no baseline snapshot', () => {
    const current: AnalyticsState = {
      ...seededState,
      tiktok_pixel_id: 'tt-1',
    };
    const diff = buildAnalyticsDiff(current, null);

    expect(diff.tiktok_pixel_id).toBe('tt-1');
    expect(diff.facebook_pixel_id).toBeNull();
    expect(diff.offline_conversions_enabled).toBe(true);
  });
});
