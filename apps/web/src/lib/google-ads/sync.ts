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

function googleAdsReauthReason(error: unknown): string | null {
  const record =
    error !== null && typeof error === 'object'
      ? (error as { code?: unknown; status?: unknown })
      : null;
  const code =
    record && typeof record.code === 'string'
      ? record.code
      : error instanceof Error
        ? error.message
        : null;
  const status = record?.status;
  if (
    code === 'GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED' &&
    (status === undefined || status === null || status === 400)
  ) {
    return code;
  }
  return null;
}

async function markGoogleAdsReauthRequired(input: {
  connection: {
    access_token_ciphertext: string | null;
    refresh_token_ciphertext: string | null;
  };
  merchantId: string;
  supabase: SupabaseClient;
  reason: string;
}): Promise<void> {
  if (!input.connection.refresh_token_ciphertext) return;
  const { error } = await input.supabase.rpc(
    'mark_google_ads_connection_reauth_if_current',
    {
      p_access_token_ciphertext: input.connection.access_token_ciphertext,
      p_merchant_id: input.merchantId,
      p_reason: input.reason,
      p_refresh_token_ciphertext: input.connection.refresh_token_ciphertext,
    }
  );
  if (error) {
    throw new GoogleAdsSyncError('REAUTH_STATUS_UPDATE_FAILED');
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
    const reauthReason = googleAdsReauthReason(error);
    if (reauthReason) {
      await markGoogleAdsReauthRequired({
        connection,
        merchantId: input.merchantId,
        reason: reauthReason,
        supabase: input.supabase,
      });
    }
    throw new GoogleAdsSyncError(
      error instanceof Error
        ? error.message.replace(/^GOOGLE_ADS_/, '')
        : 'ACCESS_TOKEN_RESOLUTION_FAILED'
    );
  }
  if (resolvedToken.encryptedAccessToken) {
    const { data: tokenUpdated, error: tokenUpdateError } =
      await input.supabase.rpc(
        'update_google_ads_connection_token_if_current',
        {
          p_access_token_ciphertext: resolvedToken.encryptedAccessToken,
          p_expected_access_token_ciphertext:
            connection.access_token_ciphertext,
          p_expected_refresh_token_ciphertext:
            connection.refresh_token_ciphertext,
          p_merchant_id: input.merchantId,
          p_token_expires_at: resolvedToken.expiresAt,
        }
      );
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
  const { error: replaceError } = await input.supabase.rpc(
    'replace_google_ads_spend_daily',
    {
      p_end_date: input.endDate,
      p_merchant_id: input.merchantId,
      p_provider_customer_id: connection.provider_customer_id,
      p_rows: records,
      p_start_date: input.startDate,
    }
  );
  if (replaceError) {
    throw new GoogleAdsSyncError('SPEND_WRITE_FAILED');
  }

  const { data: synced, error: syncedError } = await input.supabase.rpc(
    'mark_merchant_ads_connection_synced_if_current',
    {
      p_merchant_id: input.merchantId,
      p_provider: 'google_ads',
      p_provider_customer_id: connection.provider_customer_id,
    }
  );
  if (syncedError || synced !== true) {
    throw new GoogleAdsSyncError('SYNC_STATUS_UPDATE_FAILED');
  }

  return {
    customerId: connection.provider_customer_id,
    rowsWritten: records.length,
  };
}
