import type { AnalyticsPlatformConfig } from './analytics-platform-config-types';

export function hasConfiguredAnalyticsPlatform(
  config: Readonly<AnalyticsPlatformConfig>
): boolean {
  return Boolean(
    (config.facebook_pixel_id && config.facebook_capi_token) ||
      (config.tiktok_pixel_id && config.tiktok_access_token) ||
      (config.google_analytics_id && config.ga4_api_secret) ||
      (config.snapchat_pixel_id && config.snapchat_capi_token)
  );
}
