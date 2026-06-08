import type { MerchantWithAnalytics } from './analytics-pixel-provider';

const ANALYTICS_ID_KEYS = [
  'google_analytics_id',
  'facebook_pixel_id',
  'tiktok_pixel_id',
  'snapchat_pixel_id',
  'twitter_pixel_id',
] as const satisfies ReadonlyArray<keyof MerchantWithAnalytics>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeAnalyticsId(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
}

export function buildMerchantAnalyticsSettings(
  source: unknown
): MerchantWithAnalytics | null {
  const merchant = asRecord(source);
  if (!merchant) {
    return null;
  }

  const featureSettings = asRecord(merchant.feature_settings);
  return Object.fromEntries(
    ANALYTICS_ID_KEYS.map((key) => [
      key,
      normalizeAnalyticsId(featureSettings?.[key]) ??
        normalizeAnalyticsId(merchant[key]),
    ])
  ) as MerchantWithAnalytics;
}
