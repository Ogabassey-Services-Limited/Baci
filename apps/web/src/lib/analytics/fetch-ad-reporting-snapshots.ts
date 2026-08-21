import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGoogleAdsAnalyticsSnapshot } from '@/lib/google-ads/analytics-snapshot';
import type { Database } from '@/types/supabase';
import {
  buildSocialAdsAnalyticsSnapshot,
  SOCIAL_ADS_REPORTING_PROVIDERS,
} from './social-ads-analytics-snapshot';

interface FetchAdReportingSnapshotsOptions {
  endDate: string;
  merchantId: string;
  startDate: string;
  supabase: SupabaseClient<Database>;
}

export async function fetchAdReportingSnapshots({
  endDate,
  merchantId,
  startDate,
  supabase,
}: FetchAdReportingSnapshotsOptions) {
  const [
    { data: googleConnection, error: googleConnectionError },
    { data: googleRows, error: googleRowsError },
    { data: socialConnections, error: socialConnectionError },
    { data: socialRows, error: socialRowsError },
  ] = await Promise.all([
    supabase
      .from('merchant_ad_connections')
      .select('status, provider_customer_id, last_synced_at')
      .eq('merchant_id', merchantId)
      .eq('provider', 'google_ads')
      .maybeSingle(),
    supabase
      .from('merchant_ad_spend_daily')
      .select(
        'provider_customer_id, spend_date, currency_code, spend_micros, impressions, clicks, conversions, fetched_at'
      )
      .eq('merchant_id', merchantId)
      .eq('provider', 'google_ads')
      .gte('spend_date', startDate)
      .lte('spend_date', endDate)
      .order('spend_date', { ascending: true }),
    supabase
      .from('merchant_ad_connections')
      .select(
        'provider, status, provider_customer_id, provider_account_label, account_timezone, last_synced_at'
      )
      .eq('merchant_id', merchantId)
      .in('provider', [...SOCIAL_ADS_REPORTING_PROVIDERS]),
    supabase
      .from('merchant_ad_spend_daily')
      .select(
        'provider, spend_date, currency_code, spend_amount_decimal, impressions, clicks, conversions, reach, account_timezone, fetched_at'
      )
      .eq('merchant_id', merchantId)
      .in('provider', [...SOCIAL_ADS_REPORTING_PROVIDERS])
      .gte('spend_date', startDate)
      .lte('spend_date', endDate)
      .order('spend_date', { ascending: true }),
  ]);

  return {
    googleAds: googleConnectionError
      ? undefined
      : buildGoogleAdsAnalyticsSnapshot(
          googleConnection,
          googleRowsError ? [] : (googleRows ?? [])
        ),
    socialAds: buildSocialAdsAnalyticsSnapshot({
      connectionReadFailed: Boolean(socialConnectionError),
      connections: socialConnections ?? [],
      endDate,
      spendReadFailed: Boolean(socialRowsError),
      spendRows: socialRows ?? [],
      startDate,
    }),
  };
}
