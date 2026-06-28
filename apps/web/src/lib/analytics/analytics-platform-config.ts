import type { SupabaseClient } from '@supabase/supabase-js';
import { merchantHasFeature } from '@/lib/merchant-feature-gates';

export interface AnalyticsPlatformConfig {
  offline_conversions_enabled: boolean | null;
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  google_analytics_id: string | null;
  ga4_api_secret: string | null;
  snapchat_pixel_id: string | null;
  snapchat_capi_token: string | null;
}

type AnalyticsPlatformConfigRow = Partial<AnalyticsPlatformConfig>;

const PLATFORM_CREDENTIAL_FIELDS = [
  'facebook_pixel_id',
  'facebook_capi_token',
  'tiktok_pixel_id',
  'tiktok_access_token',
  'google_analytics_id',
  'ga4_api_secret',
  'snapchat_pixel_id',
  'snapchat_capi_token',
] as const satisfies readonly (keyof AnalyticsPlatformConfig)[];

const MERCHANT_SELECT = [
  'offline_conversions_enabled',
  ...PLATFORM_CREDENTIAL_FIELDS,
].join(', ');
const MERCHANT_ENTITLEMENT_SELECT =
  'plan_tier, plan_expires_at, premium_features';

const FEATURE_SETTINGS_SELECT = PLATFORM_CREDENTIAL_FIELDS.join(', ');
const LOCKED_ANALYTICS_PLATFORM_CONFIG: AnalyticsPlatformConfig = {
  offline_conversions_enabled: false,
  facebook_pixel_id: null,
  facebook_capi_token: null,
  tiktok_pixel_id: null,
  tiktok_access_token: null,
  google_analytics_id: null,
  ga4_api_secret: null,
  snapchat_pixel_id: null,
  snapchat_capi_token: null,
};

function normalizedCredential(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function selectCredential(
  featureValue: string | null | undefined,
  merchantValue: string | null | undefined
): string | null {
  return (
    normalizedCredential(featureValue) ?? normalizedCredential(merchantValue)
  );
}

export function mergeAnalyticsPlatformConfig(
  merchantConfig: AnalyticsPlatformConfigRow | null | undefined,
  featureConfig: AnalyticsPlatformConfigRow | null | undefined
): AnalyticsPlatformConfig {
  return {
    offline_conversions_enabled:
      merchantConfig?.offline_conversions_enabled ?? null,
    facebook_pixel_id: selectCredential(
      featureConfig?.facebook_pixel_id,
      merchantConfig?.facebook_pixel_id
    ),
    facebook_capi_token: selectCredential(
      featureConfig?.facebook_capi_token,
      merchantConfig?.facebook_capi_token
    ),
    tiktok_pixel_id: selectCredential(
      featureConfig?.tiktok_pixel_id,
      merchantConfig?.tiktok_pixel_id
    ),
    tiktok_access_token: selectCredential(
      featureConfig?.tiktok_access_token,
      merchantConfig?.tiktok_access_token
    ),
    google_analytics_id: selectCredential(
      featureConfig?.google_analytics_id,
      merchantConfig?.google_analytics_id
    ),
    ga4_api_secret: selectCredential(
      featureConfig?.ga4_api_secret,
      merchantConfig?.ga4_api_secret
    ),
    snapchat_pixel_id: selectCredential(
      featureConfig?.snapchat_pixel_id,
      merchantConfig?.snapchat_pixel_id
    ),
    snapchat_capi_token: selectCredential(
      featureConfig?.snapchat_capi_token,
      merchantConfig?.snapchat_capi_token
    ),
  };
}

export function hasConfiguredAnalyticsPlatform(
  config: AnalyticsPlatformConfig
): boolean {
  return Boolean(
    (config.facebook_pixel_id && config.facebook_capi_token) ||
      (config.tiktok_pixel_id && config.tiktok_access_token) ||
      (config.google_analytics_id && config.ga4_api_secret) ||
      (config.snapchat_pixel_id && config.snapchat_capi_token)
  );
}

export async function fetchAnalyticsPlatformConfig(
  supabase: SupabaseClient,
  merchantId: string
): Promise<AnalyticsPlatformConfig | null> {
  const { data: merchantEntitlement, error: merchantEntitlementError } =
    await supabase
      .from('merchants')
      .select(MERCHANT_ENTITLEMENT_SELECT)
      .eq('id', merchantId)
      .maybeSingle();

  if (merchantEntitlementError || !merchantEntitlement) {
    return null;
  }

  if (!merchantHasFeature(merchantEntitlement, 'growth_integrations')) {
    return { ...LOCKED_ANALYTICS_PLATFORM_CONFIG };
  }

  const { data: merchantConfig, error: merchantError } = await supabase
    .from('merchants')
    .select(MERCHANT_SELECT)
    .eq('id', merchantId)
    .maybeSingle();

  if (merchantError || !merchantConfig) {
    return null;
  }

  const { data: featureConfig } = await supabase
    .from('merchant_feature_settings')
    .select(FEATURE_SETTINGS_SELECT)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  return mergeAnalyticsPlatformConfig(
    merchantConfig as AnalyticsPlatformConfigRow,
    featureConfig as AnalyticsPlatformConfigRow | null
  );
}
