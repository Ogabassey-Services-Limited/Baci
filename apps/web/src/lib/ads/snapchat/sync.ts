import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptAdsToken } from '@/lib/ads/crypto';
import { snapchatAdsSyncRequestSchema } from '@/schemas/snapchat-ads';
import {
  resolveSnapchatAdsAccessToken,
  resolveSnapchatAdsRefreshToken,
} from './access-token';
import { getSnapchatAdsConfig } from './config';
import {
  SNAPCHAT_ADS_PROVIDER,
  SNAPCHAT_ADS_REQUIRED_SCOPES,
  SNAPCHAT_ADS_TRAILING_SYNC_DAYS,
} from './constants';
import { refreshSnapchatAdsAccessToken } from './oauth';
import {
  fetchSnapchatAdsDailyReport,
  listSnapchatAdsAccounts,
} from './provider';

export class SnapchatAdsSyncError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SnapchatAdsSyncError';
  }
}
const activeSyncs = new Map<
  string,
  Promise<{ accountId: string; rowsWritten: number }>
>();

export function snapchatAdsTrailingStartDate(
  startDate: string,
  endDate: string,
  now = new Date()
): string {
  const today = now.toISOString().slice(0, 10);
  if (endDate < today) return startDate;
  const trailing = new Date(`${endDate}T00:00:00.000Z`);
  trailing.setUTCDate(trailing.getUTCDate() - SNAPCHAT_ADS_TRAILING_SYNC_DAYS);
  return trailing.toISOString().slice(0, 10) < startDate
    ? trailing.toISOString().slice(0, 10)
    : startDate;
}
function codeOf(error: unknown): string {
  return error &&
    typeof error === 'object' &&
    typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : error instanceof Error
      ? error.message
      : 'SNAPCHAT_ADS_SYNC_FAILED';
}
export async function markSnapchatAdsReauthRequired(input: {
  connection: {
    access_token_ciphertext: string | null;
    provider_customer_id: string | null;
    refresh_token_ciphertext: string | null;
  };
  failureCode: string;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  if (!input.connection.access_token_ciphertext)
    throw new SnapchatAdsSyncError('SNAPCHAT_ADS_REAUTH_PERSIST_FAILED');
  const { data, error } = await input.supabase.rpc(
    'upsert_merchant_ads_connection',
    {
      p_access_token_ciphertext: input.connection.access_token_ciphertext,
      p_account_timezone: null,
      p_attribution_metadata: {
        provider: SNAPCHAT_ADS_PROVIDER,
        reauthRequired: true,
      },
      p_merchant_id: input.merchantId,
      p_metadata: { failureCode: input.failureCode, reauthRequired: true },
      p_provider: SNAPCHAT_ADS_PROVIDER,
      p_provider_account_label: null,
      p_provider_customer_id: input.connection.provider_customer_id,
      p_refresh_token_ciphertext: input.connection.refresh_token_ciphertext,
      p_scopes: [...SNAPCHAT_ADS_REQUIRED_SCOPES],
      p_status: 'error',
      p_token_expires_at: null,
    }
  );
  if (error || !data)
    throw new SnapchatAdsSyncError('SNAPCHAT_ADS_REAUTH_PERSIST_FAILED');
}
export async function syncSnapchatAdsSpendForMerchant(
  input: {
    endDate: string;
    merchantId: string;
    startDate: string;
    supabase: SupabaseClient;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{ accountId: string; rowsWritten: number }> {
  if (!snapchatAdsSyncRequestSchema.safeParse(input).success)
    throw new SnapchatAdsSyncError('INVALID_DATE_RANGE');
  const config = getSnapchatAdsConfig();
  const read = await input.supabase.rpc('get_merchant_ads_connection_secret', {
    p_merchant_id: input.merchantId,
    p_provider: SNAPCHAT_ADS_PROVIDER,
  });
  if (read.error) throw new SnapchatAdsSyncError('CONNECTION_READ_FAILED');
  const connection = read.data?.[0];
  if (!connection?.provider_customer_id || connection.status !== 'active')
    throw new SnapchatAdsSyncError('SNAPCHAT_ADS_ACCOUNT_NOT_SELECTED');
  let token: string;
  try {
    token = resolveSnapchatAdsAccessToken(connection, config);
  } catch (error) {
    throw new SnapchatAdsSyncError(codeOf(error));
  }
  const startDate = snapchatAdsTrailingStartDate(
    input.startDate,
    input.endDate
  );
  if (
    connection.token_expires_at &&
    Date.parse(connection.token_expires_at) <= Date.now()
  ) {
    try {
      const grant = await refreshSnapchatAdsAccessToken({
        ...config,
        refreshToken: resolveSnapchatAdsRefreshToken(connection, config),
      });
      const updated = await input.supabase.rpc(
        'update_merchant_ads_connection_token',
        {
          p_access_token_ciphertext: encryptAdsToken(
            grant.accessToken,
            config.tokenEncryptionKey,
            SNAPCHAT_ADS_PROVIDER
          ),
          p_merchant_id: input.merchantId,
          p_provider: SNAPCHAT_ADS_PROVIDER,
          p_token_expires_at: new Date(
            Date.now() + grant.expiresIn * 1000
          ).toISOString(),
        }
      );
      if (updated.error || updated.data !== true)
        throw new SnapchatAdsSyncError('TOKEN_REFRESH_WRITE_FAILED');
      token = grant.accessToken;
    } catch (error) {
      await markSnapchatAdsReauthRequired({
        connection,
        failureCode: codeOf(error),
        merchantId: input.merchantId,
        supabase: input.supabase,
      });
      throw error;
    }
  }
  const key = `${input.merchantId}:${connection.provider_customer_id}:${startDate}:${input.endDate}`;
  const current = activeSyncs.get(key);
  if (current) return current;
  const work = (async () => {
    try {
      const account = (
        await listSnapchatAdsAccounts({ accessToken: token }, fetchImpl)
      ).find((item) => item.accountId === connection.provider_customer_id);
      if (!account)
        throw new SnapchatAdsSyncError('SNAPCHAT_ADS_ACCOUNT_NOT_ACCESSIBLE');
      const reports = await fetchSnapchatAdsDailyReport(
        {
          accessToken: token,
          accountId: account.accountId,
          currencyCode: account.currencyCode,
          endDate: input.endDate,
          startDate,
          timezoneName: account.timezoneName,
        },
        fetchImpl
      );
      if (
        reports.some(
          (report) =>
            report.currencyCode !== account.currencyCode ||
            report.timezoneName !== account.timezoneName
        )
      )
        throw new SnapchatAdsSyncError(
          'SNAPCHAT_ADS_ACCOUNT_CURRENCY_OR_TIMEZONE_MISMATCH'
        );
      const rows = reports.map((report) => ({
        account_timezone: report.timezoneName,
        attribution_metadata: {
          actionReportTime: 'conversion',
          provider: SNAPCHAT_ADS_PROVIDER,
          providerClicksLabel: 'Swipe Ups',
          providerConversionsLabel: 'Snapchat-attributed purchases',
          swipeUpAttributionWindow: '28_DAY',
          viewAttributionWindow: '1_DAY',
        },
        clicks: report.clicks,
        conversions: report.conversions,
        currency_code: report.currencyCode,
        fetched_at: new Date().toISOString(),
        impressions: report.impressions,
        provider_customer_id: report.accountId,
        reach: null,
        spend_amount_decimal: report.spendAmountDecimal,
        spend_date: report.spendDate,
        spend_micros: report.spendMicros,
      }));
      let rowsWritten = 0;
      if (rows.length) {
        const written = await input.supabase.rpc(
          'upsert_merchant_ads_spend_daily',
          {
            p_merchant_id: input.merchantId,
            p_provider: SNAPCHAT_ADS_PROVIDER,
            p_rows: rows,
          }
        );
        if (written.error) throw new SnapchatAdsSyncError('SPEND_WRITE_FAILED');
        rowsWritten = written.data ?? rows.length;
      }
      const marked = await input.supabase.rpc(
        'mark_merchant_ads_connection_synced',
        { p_merchant_id: input.merchantId, p_provider: SNAPCHAT_ADS_PROVIDER }
      );
      if (marked.error || marked.data !== true)
        throw new SnapchatAdsSyncError('SYNC_STATUS_UPDATE_FAILED');
      return { accountId: account.accountId, rowsWritten };
    } catch (error) {
      if (codeOf(error) === 'SNAPCHAT_ADS_ACCESS_REVOKED')
        await markSnapchatAdsReauthRequired({
          connection,
          failureCode: codeOf(error),
          merchantId: input.merchantId,
          supabase: input.supabase,
        });
      throw error;
    }
  })();
  activeSyncs.set(key, work);
  try {
    return await work;
  } finally {
    activeSyncs.delete(key);
  }
}

export function encryptedSnapchatRefreshTokenForStorage(
  refreshToken: string,
  tokenEncryptionKey: string
): string {
  return encryptAdsToken(
    refreshToken,
    tokenEncryptionKey,
    SNAPCHAT_ADS_PROVIDER
  );
}
