import type { SupabaseClient } from '@supabase/supabase-js';
import { merchantHasFeature } from '@/lib/merchant-has-feature';
import type { Database } from '@/types/supabase';
import type {
  AnalyticsPlatformConfig,
  AnalyticsPlatformConfigRow,
} from './analytics-platform-config-types';
import { mergeAnalyticsPlatformConfig } from './merge-analytics-platform-config';

const PROVIDER_FIELDS =
  'facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token';
const MERCHANT_FIELDS =
  'offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token';
const ENTITLEMENT_FIELDS = 'plan_tier, plan_expires_at, premium_features';
const LOCKED_CONFIG: Readonly<AnalyticsPlatformConfig> = Object.freeze({
  offline_conversions_enabled: false,
  facebook_pixel_id: null,
  facebook_capi_token: null,
  tiktok_pixel_id: null,
  tiktok_access_token: null,
  google_analytics_id: null,
  ga4_api_secret: null,
  snapchat_pixel_id: null,
  snapchat_capi_token: null,
});

export async function fetchAnalyticsPlatformConfig(
  client: SupabaseClient<Database>,
  merchantId: string
): Promise<AnalyticsPlatformConfig | null> {
  const { data: entitlement, error: entitlementError } = await client
    .from('merchants')
    .select(ENTITLEMENT_FIELDS)
    .eq('id', merchantId)
    .maybeSingle();
  if (entitlementError || !entitlement) return null;
  if (!merchantHasFeature(entitlement, 'growth_integrations')) {
    return { ...LOCKED_CONFIG };
  }

  const { data: merchantConfig, error: merchantError } = await client
    .from('merchants')
    .select(MERCHANT_FIELDS)
    .eq('id', merchantId)
    .maybeSingle();
  if (merchantError || !merchantConfig) return null;
  const { data: featureConfig, error: featureError } = await client
    .from('merchant_feature_settings')
    .select(PROVIDER_FIELDS)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (featureError) return null;
  return mergeAnalyticsPlatformConfig(
    merchantConfig as AnalyticsPlatformConfigRow,
    featureConfig as AnalyticsPlatformConfigRow | null
  );
}
