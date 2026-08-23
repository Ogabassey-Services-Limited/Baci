import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type GoogleAdsResolvedAccessToken,
  resolveGoogleAdsAccessToken,
} from '@/lib/google-ads/access-token';
import {
  getGoogleAdsOAuthConfig,
  getGoogleAdsReportingConfig,
} from '@/lib/google-ads/config';
import { fetchGoogleAdsDailySpend } from '@/lib/google-ads/provider';
import { googleAdsSyncRequestSchema } from '@/schemas/google-ads';

export class GoogleAdsSyncError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'GoogleAdsSyncError';
    this.code = code;
  }
}

export async function syncGoogleAdsSpendForMerchant(
  input: {
    endDate: string;
    merchantId: string;
    startDate: string;
    supabase: SupabaseClient;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{ rowsWritten: number; customerId: string }> {
  if (
    !googleAdsSyncRequestSchema.safeParse({
      endDate: input.endDate,
      startDate: input.startDate,
    }).success
  ) {
    throw new GoogleAdsSyncError('INVALID_DATE_RANGE');
  }
  const oauthConfig = getGoogleAdsOAuthConfig();
  const reportingConfig = getGoogleAdsReportingConfig();
  const { data: connections, error: connectionError } =
    await input.supabase.rpc('get_google_ads_connection_secret', {
      p_merchant_id: input.merchantId,
    });
  if (connectionError) throw new GoogleAdsSyncError('CONNECTION_READ_FAILED');
  const connection = connections?.[0] ?? null;
  if (!connection?.provider_customer_id) {
    throw new GoogleAdsSyncError('GOOGLE_ADS_CUSTOMER_NOT_SELECTED');
  }

  let resolvedToken: GoogleAdsResolvedAccessToken;
  try {
    resolvedToken = await resolveGoogleAdsAccessToken(
      connection,
      oauthConfig,
      fetchImpl
    );
  } catch (error) {
    throw new GoogleAdsSyncError(
      error instanceof Error
        ? error.message.replace(/^GOOGLE_ADS_/, '')
        : 'ACCESS_TOKEN_RESOLUTION_FAILED'
    );
  }
  if (resolvedToken.encryptedAccessToken) {
    const { data: tokenUpdated, error: tokenUpdateError } =
      await input.supabase.rpc('update_google_ads_connection_token', {
        p_access_token_ciphertext: resolvedToken.encryptedAccessToken,
        p_merchant_id: input.merchantId,
        p_token_expires_at: resolvedToken.expiresAt,
      });
    if (tokenUpdateError || tokenUpdated !== true) {
      throw new GoogleAdsSyncError('TOKEN_UPDATE_FAILED');
    }
  }

  const rows = await fetchGoogleAdsDailySpend(
    {
      accessToken: resolvedToken.accessToken,
      customerId: connection.provider_customer_id,
      endDate: input.endDate,
      reportingConfig,
      startDate: input.startDate,
    },
    fetchImpl
  );
  const records = rows.map((row) => ({
    clicks: Math.trunc(row.clicks),
    conversions: row.conversions,
    currency_code: row.currencyCode,
    fetched_at: new Date().toISOString(),
    impressions: Math.trunc(row.impressions),
    provider_customer_id: row.customerId,
    spend_date: row.date,
    spend_micros: Math.trunc(row.spendMicros),
  }));
  if (records.length > 0) {
    const { error: upsertError } = await input.supabase.rpc(
      'upsert_google_ads_spend_daily',
      { p_merchant_id: input.merchantId, p_rows: records }
    );
    if (upsertError) throw new GoogleAdsSyncError('SPEND_WRITE_FAILED');
  }

  const { data: synced, error: syncedError } = await input.supabase.rpc(
    'mark_google_ads_connection_synced',
    { p_merchant_id: input.merchantId }
  );
  if (syncedError || synced !== true) {
    throw new GoogleAdsSyncError('SYNC_STATUS_UPDATE_FAILED');
  }

  return {
    customerId: connection.provider_customer_id,
    rowsWritten: records.length,
  };
}
