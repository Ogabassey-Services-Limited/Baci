import type {
  AnalyticsPlatformConfig,
  AnalyticsPlatformConfigRow,
} from './analytics-platform-config-types';

export function mergeAnalyticsPlatformConfig(
  merchantConfig: AnalyticsPlatformConfigRow | null | undefined,
  featureConfig: AnalyticsPlatformConfigRow | null | undefined
): AnalyticsPlatformConfig {
  const credential = (key: keyof AnalyticsPlatformConfig) => {
    const featureValue = featureConfig?.[key];
    const merchantValue = merchantConfig?.[key];
    const normalizedFeature =
      typeof featureValue === 'string' ? featureValue.trim() : '';
    const normalizedMerchant =
      typeof merchantValue === 'string' ? merchantValue.trim() : '';
    return normalizedFeature || normalizedMerchant || null;
  };
  return {
    offline_conversions_enabled:
      merchantConfig?.offline_conversions_enabled ?? null,
    facebook_pixel_id: credential('facebook_pixel_id'),
    facebook_capi_token: credential('facebook_capi_token'),
    tiktok_pixel_id: credential('tiktok_pixel_id'),
    tiktok_access_token: credential('tiktok_access_token'),
    google_analytics_id: credential('google_analytics_id'),
    ga4_api_secret: credential('ga4_api_secret'),
    snapchat_pixel_id: credential('snapchat_pixel_id'),
    snapchat_capi_token: credential('snapchat_capi_token'),
  };
}
