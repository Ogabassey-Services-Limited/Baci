import type { MerchantFeatureSettings } from './merchant-feature-settings-contract';

export type MerchantFeatureCacheRevalidator = (
  merchantId: string,
  updates: Record<string, unknown>
) => void;

const growthIntegrationSettingsFields = new Set<keyof MerchantFeatureSettings>([
  'google_analytics_id',
  'ga4_api_secret',
  'facebook_pixel_id',
  'facebook_capi_token',
  'tiktok_pixel_id',
  'tiktok_access_token',
  'snapchat_pixel_id',
  'snapchat_capi_token',
  'twitter_pixel_id',
]);

export function hasNonEmptyGrowthIntegrationSetting(
  updates: Record<string, unknown>
) {
  return [...growthIntegrationSettingsFields].some((field) => {
    if (!(field in updates)) return false;
    const value = updates[field];
    return typeof value === 'string'
      ? value.trim().length > 0
      : value !== null && value !== undefined;
  });
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
