import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { metaAdsSyncRequestSchema } from '@/schemas/meta-ads';
import { resolveMetaAdsAccessToken } from './access-token';
import { getMetaAdsConfig } from './config';
import {
  META_ADS_CONVERSION_ACTION_ALLOWLIST_VERSION,
  META_ADS_CONVERSION_ACTION_TYPES,
  META_ADS_PROVIDER,
} from './constants';
import {
  fetchMetaAdsDailyInsights,
  listMetaAdsAccounts,
  type MetaAdsDailyInsight,
} from './provider';

export class MetaAdsSyncError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'MetaAdsSyncError';
  }
}

function actionCount(actions: MetaAdsDailyInsight['actions']): string {
  return actions
    .filter((action) => META_ADS_CONVERSION_ACTION_TYPES.has(action.actionType))
    .reduce((total, action) => total + Number(action.value), 0)
    .toString();
}

export async function syncMetaAdsSpendForMerchant(
  input: {
    endDate: string;
    merchantId: string;
    startDate: string;
    supabase: SupabaseClient;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{ accountId: string; rowsWritten: number }> {
  if (
    !metaAdsSyncRequestSchema.safeParse({
      endDate: input.endDate,
      startDate: input.startDate,
    }).success
  ) {
    throw new MetaAdsSyncError('INVALID_DATE_RANGE');
  }
  const config = getMetaAdsConfig();
  const { data: connections, error: connectionError } =
    await input.supabase.rpc('get_merchant_ads_connection_secret', {
      p_merchant_id: input.merchantId,
      p_provider: META_ADS_PROVIDER,
    });
  if (connectionError) throw new MetaAdsSyncError('CONNECTION_READ_FAILED');
  const connection = connections?.[0] ?? null;
  if (!connection?.provider_customer_id)
    throw new MetaAdsSyncError('META_ADS_ACCOUNT_NOT_SELECTED');
  let accessToken: string;
  try {
    accessToken = resolveMetaAdsAccessToken(connection, config);
  } catch (error) {
    throw new MetaAdsSyncError(
      error instanceof Error ? error.message : 'META_ADS_REAUTH_REQUIRED'
    );
  }
  const accounts = await listMetaAdsAccounts(accessToken, fetchImpl);
  const account = accounts.find(
    (candidate) => candidate.accountId === connection.provider_customer_id
  );
  if (!account) throw new MetaAdsSyncError('META_ADS_ACCOUNT_NOT_ACCESSIBLE');
  const insights = await fetchMetaAdsDailyInsights(
    {
      accessToken,
      accountId: account.accountId,
      endDate: input.endDate,
      startDate: input.startDate,
    },
    fetchImpl
  );
  const fetchedAt = new Date().toISOString();
  const records = insights.map((insight) => ({
    account_timezone: account.timezoneName,
    attribution_metadata: {
      actionValues: insight.actionValues,
      actions: insight.actions,
      attributionSetting: insight.attributionSetting,
      provider: 'meta_ads',
      providerAttributedConversionAllowlistVersion:
        META_ADS_CONVERSION_ACTION_ALLOWLIST_VERSION,
      providerDateStart: insight.dateStart,
      providerDateStop: insight.dateStop,
      providerTimezoneOffsetHours: account.timezoneOffsetHours,
      providerVersion: 'v25.0',
    },
    clicks: insight.clicks,
    conversions: actionCount(insight.actions),
    currency_code: account.currencyCode,
    fetched_at: fetchedAt,
    impressions: insight.impressions,
    provider_customer_id: insight.accountId,
    reach: insight.reach,
    // Legacy Google compatibility column only. Meta's authoritative amount is
    // the exact decimal field below and is never reconstructed from this value.
    spend_micros: '0',
    spend_amount_decimal: insight.spendAmountDecimal,
    spend_date: insight.dateStart,
  }));
  let rowsWritten = 0;
  if (records.length > 0) {
    const { data, error } = await input.supabase.rpc(
      'upsert_merchant_ads_spend_daily',
      {
        p_merchant_id: input.merchantId,
        p_provider: META_ADS_PROVIDER,
        p_rows: records,
      }
    );
    if (error) throw new MetaAdsSyncError('SPEND_WRITE_FAILED');
    rowsWritten = data ?? records.length;
  }
  const { data: synced, error: syncedError } = await input.supabase.rpc(
    'mark_merchant_ads_connection_synced',
    { p_merchant_id: input.merchantId, p_provider: META_ADS_PROVIDER }
  );
  if (syncedError || synced !== true)
    throw new MetaAdsSyncError('SYNC_STATUS_UPDATE_FAILED');
  return { accountId: account.accountId, rowsWritten };
}
