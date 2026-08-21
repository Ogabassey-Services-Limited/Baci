import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { tiktokAdsSyncRequestSchema } from '@/schemas/tiktok-ads';
import { resolveTikTokAdsAccessToken } from './access-token';
import { getTikTokAdsConfig } from './config';
import {
  TIKTOK_ADS_LATENCY_LABEL,
  TIKTOK_ADS_MAX_SYNC_DAYS,
  TIKTOK_ADS_PROVIDER,
  TIKTOK_ADS_REQUIRED_SCOPES,
} from './constants';
import {
  fetchTikTokAdsDailyReport,
  listTikTokAdsAccounts,
  TikTokAdsProviderError,
} from './provider';

export class TikTokAdsSyncError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'TikTokAdsSyncError';
  }
}
export class TikTokAdsReauthPersistenceError extends Error {
  readonly code = 'TIKTOK_ADS_REAUTH_PERSIST_FAILED';
  constructor() {
    super('TIKTOK_ADS_REAUTH_PERSIST_FAILED');
    this.name = 'TikTokAdsReauthPersistenceError';
  }
}
const inFlightSyncs = new Map<
  string,
  Promise<{ accountId: string; rowsWritten: number }>
>();

export function tiktokAdsDateChunks(
  startDate: string,
  endDate: string
): Array<{ startDate: string; endDate: string }> {
  const chunks: Array<{ startDate: string; endDate: string }> = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const chunkStart = cursor.toISOString().slice(0, 10);
    const chunkEndDate = new Date(cursor);
    chunkEndDate.setUTCDate(
      chunkEndDate.getUTCDate() + TIKTOK_ADS_MAX_SYNC_DAYS - 1
    );
    const chunkEnd = chunkEndDate > end ? end : chunkEndDate;
    chunks.push({
      startDate: chunkStart,
      endDate: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}
export async function markTikTokAdsReauthRequired(input: {
  connection: {
    access_token_ciphertext: string | null;
    provider_customer_id: string | null;
  };
  failureCode: string;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  if (!input.connection.access_token_ciphertext)
    throw new TikTokAdsReauthPersistenceError();
  const { data, error } = await input.supabase.rpc(
    'upsert_merchant_ads_connection',
    {
      p_access_token_ciphertext: input.connection.access_token_ciphertext,
      p_account_timezone: null,
      p_attribution_metadata: {
        provider: TIKTOK_ADS_PROVIDER,
        reauthRequired: true,
      },
      p_merchant_id: input.merchantId,
      p_metadata: { failureCode: input.failureCode, reauthRequired: true },
      p_provider: TIKTOK_ADS_PROVIDER,
      p_provider_account_label: null,
      p_provider_customer_id: input.connection.provider_customer_id,
      p_refresh_token_ciphertext: null,
      p_scopes: [...TIKTOK_ADS_REQUIRED_SCOPES],
      p_status: 'error',
      p_token_expires_at: null,
    }
  );
  if (error || !data) throw new TikTokAdsReauthPersistenceError();
}
function errorCode(error: unknown): string {
  return error instanceof TikTokAdsProviderError ||
    error instanceof TikTokAdsSyncError
    ? error.code
    : error instanceof Error
      ? error.message
      : 'TIKTOK_ADS_SYNC_FAILED';
}
function needsReauth(error: unknown): boolean {
  return (
    errorCode(error) === 'TIKTOK_ADS_ACCESS_REVOKED' ||
    errorCode(error) === 'TIKTOK_ADS_REAUTH_REQUIRED'
  );
}

export async function syncTikTokAdsSpendForMerchant(
  input: {
    endDate: string;
    merchantId: string;
    startDate: string;
    supabase: SupabaseClient;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{ accountId: string; rowsWritten: number }> {
  if (
    !tiktokAdsSyncRequestSchema.safeParse({
      endDate: input.endDate,
      startDate: input.startDate,
    }).success
  )
    throw new TikTokAdsSyncError('INVALID_DATE_RANGE');
  const config = getTikTokAdsConfig();
  const { data, error } = await input.supabase.rpc(
    'get_merchant_ads_connection_secret',
    { p_merchant_id: input.merchantId, p_provider: TIKTOK_ADS_PROVIDER }
  );
  if (error) throw new TikTokAdsSyncError('CONNECTION_READ_FAILED');
  const connection = data?.[0];
  if (!connection?.provider_customer_id || connection.status !== 'active')
    throw new TikTokAdsSyncError('TIKTOK_ADS_ACCOUNT_NOT_SELECTED');
  let token: string;
  try {
    token = resolveTikTokAdsAccessToken(connection, config);
  } catch (cause) {
    throw new TikTokAdsSyncError(errorCode(cause));
  }
  const key = `${input.merchantId}:${connection.provider_customer_id}:${input.startDate}:${input.endDate}`;
  const active = inFlightSyncs.get(key);
  if (active) return active;
  const work = (async () => {
    try {
      const accounts = await listTikTokAdsAccounts(
        {
          accessToken: token,
          appId: config.appId,
          appSecret: config.appSecret,
        },
        fetchImpl
      );
      const account = accounts.find(
        (item) => item.accountId === connection.provider_customer_id
      );
      if (!account)
        throw new TikTokAdsSyncError('TIKTOK_ADS_ACCOUNT_NOT_ACCESSIBLE');
      let rowsWritten = 0;
      for (const range of tiktokAdsDateChunks(input.startDate, input.endDate)) {
        const reports = await fetchTikTokAdsDailyReport(
          { accessToken: token, accountId: account.accountId, ...range },
          fetchImpl
        );
        const firstReport = reports[0];
        if (
          firstReport &&
          reports.some(
            (report) =>
              report.currencyCode !== firstReport.currencyCode ||
              report.timezoneName !== firstReport.timezoneName
          )
        )
          throw new TikTokAdsSyncError(
            'TIKTOK_ADS_ACCOUNT_CURRENCY_OR_TIMEZONE_MISMATCH'
          );
        const rows = reports.map((report) => ({
          account_timezone: report.timezoneName,
          attribution_metadata: {
            provider: TIKTOK_ADS_PROVIDER,
            providerConversionsLabel: 'TikTok optimization-event conversions',
            providerLatency: TIKTOK_ADS_LATENCY_LABEL,
            providerVersion: 'v1.3',
          },
          clicks: report.clicks,
          conversions: report.conversions,
          currency_code: report.currencyCode,
          fetched_at: new Date().toISOString(),
          impressions: report.impressions,
          provider_customer_id: report.accountId,
          reach: report.reach,
          spend_amount_decimal: report.spendAmountDecimal,
          spend_date: report.spendDate,
          spend_micros: '0',
        }));
        if (rows.length) {
          const written = await input.supabase.rpc(
            'upsert_merchant_ads_spend_daily',
            {
              p_merchant_id: input.merchantId,
              p_provider: TIKTOK_ADS_PROVIDER,
              p_rows: rows,
            }
          );
          if (written.error) throw new TikTokAdsSyncError('SPEND_WRITE_FAILED');
          rowsWritten += written.data ?? rows.length;
        }
      }
      const marked = await input.supabase.rpc(
        'mark_merchant_ads_connection_synced',
        { p_merchant_id: input.merchantId, p_provider: TIKTOK_ADS_PROVIDER }
      );
      if (marked.error || marked.data !== true)
        throw new TikTokAdsSyncError('SYNC_STATUS_UPDATE_FAILED');
      return { accountId: account.accountId, rowsWritten };
    } catch (cause) {
      if (needsReauth(cause)) {
        try {
          await markTikTokAdsReauthRequired({
            connection,
            failureCode: errorCode(cause),
            merchantId: input.merchantId,
            supabase: input.supabase,
          });
        } catch {
          throw new TikTokAdsSyncError('TIKTOK_ADS_REAUTH_PERSIST_FAILED');
        }
      }
      throw cause;
    }
  })();
  inFlightSyncs.set(key, work);
  try {
    return await work;
  } finally {
    inFlightSyncs.delete(key);
  }
}
