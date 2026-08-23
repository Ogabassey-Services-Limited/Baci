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
  MetaAdsProviderError,
  type MetaAdsUsageTelemetry,
} from './provider';

export class MetaAdsSyncError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'MetaAdsSyncError';
  }
}

export class MetaAdsReauthPersistenceError extends Error {
  readonly code = 'META_ADS_REAUTH_PERSIST_FAILED';

  constructor() {
    super('META_ADS_REAUTH_PERSIST_FAILED');
    this.name = 'MetaAdsReauthPersistenceError';
  }
}

const inFlightSyncs = new Map<
  string,
  Promise<{ accountId: string; rowsWritten: number }>
>();

function addExactDecimalStrings(values: string[]): string {
  const maxScale = values.reduce(
    (maximum, value) => Math.max(maximum, value.split('.')[1]?.length ?? 0),
    0
  );
  const total = values.reduce((sum, value) => {
    const [whole, fractional = ''] = value.split('.');
    return sum + BigInt(`${whole}${fractional.padEnd(maxScale, '0')}`);
  }, 0n);
  if (maxScale === 0) return total.toString();
  const padded = total.toString().padStart(maxScale + 1, '0');
  const whole = padded.slice(0, -maxScale);
  const fractional = padded.slice(-maxScale).replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole;
}

function actionCount(actions: MetaAdsDailyInsight['actions']): string {
  return addExactDecimalStrings(
    actions
      .filter((action) =>
        META_ADS_CONVERSION_ACTION_TYPES.has(action.actionType)
      )
      .map((action) => action.value)
  );
}

export async function markMetaAdsReauthRequired(input: {
  connection: {
    access_token_ciphertext: string | null;
    provider_customer_id: string | null;
    refresh_token_ciphertext?: string | null;
  };
  failureCode: string;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  if (!input.connection.access_token_ciphertext)
    throw new MetaAdsReauthPersistenceError();
  const { error } = await input.supabase.rpc(
    'mark_merchant_ads_connection_reauth_if_current',
    {
      p_access_token_ciphertext: input.connection.access_token_ciphertext,
      p_merchant_id: input.merchantId,
      p_provider: META_ADS_PROVIDER,
      p_refresh_token_ciphertext:
        input.connection.refresh_token_ciphertext ?? null,
      p_reason: input.failureCode,
    }
  );
  // A false result means a concurrent reauthorization already replaced the
  // credentials, so there is no current connection left for this request to
  // mark. A database error, however, means the durable marker was not written.
  if (error) throw new MetaAdsReauthPersistenceError();
}

function shouldRequireReauth(error: unknown): boolean {
  const candidateCode =
    error instanceof MetaAdsProviderError
      ? error.code
      : error && typeof error === 'object'
        ? (error as { code?: unknown }).code
        : null;
  const code =
    typeof candidateCode === 'string'
      ? candidateCode
      : error instanceof Error
        ? error.message
        : null;
  return (
    code === 'META_ADS_REAUTH_REQUIRED' ||
    code === 'META_ADS_ACCESS_REVOKED' ||
    code === 'META_ADS_ADS_READ_NOT_GRANTED'
  );
}

function reauthFailureCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return error instanceof Error ? error.message : 'META_ADS_REAUTH_REQUIRED';
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
    if (shouldRequireReauth(error)) {
      try {
        await markMetaAdsReauthRequired({
          connection,
          failureCode: reauthFailureCode(error),
          merchantId: input.merchantId,
          supabase: input.supabase,
        });
      } catch {
        throw new MetaAdsSyncError('META_ADS_REAUTH_PERSIST_FAILED');
      }
    }
    throw new MetaAdsSyncError(reauthFailureCode(error));
  }
  const syncKey = `${input.merchantId}:${connection.provider_customer_id}:${input.startDate}:${input.endDate}`;
  const activeSync = inFlightSyncs.get(syncKey);
  if (activeSync) return activeSync;
  const syncPromise = syncSelectedMetaAdsAccount({
    accessToken,
    connection,
    endDate: input.endDate,
    fetchImpl,
    merchantId: input.merchantId,
    startDate: input.startDate,
    supabase: input.supabase,
  });
  inFlightSyncs.set(syncKey, syncPromise);
  try {
    return await syncPromise;
  } finally {
    inFlightSyncs.delete(syncKey);
  }
}

async function syncSelectedMetaAdsAccount(input: {
  accessToken: string;
  connection: {
    access_token_ciphertext: string | null;
    provider_customer_id: string | null;
    refresh_token_ciphertext?: string | null;
  };
  endDate: string;
  fetchImpl: typeof fetch;
  merchantId: string;
  startDate: string;
  supabase: SupabaseClient;
}): Promise<{ accountId: string; rowsWritten: number }> {
  let usageTelemetry: MetaAdsUsageTelemetry | null = null;
  try {
    const collectTelemetry = (telemetry: MetaAdsUsageTelemetry) => {
      usageTelemetry = telemetry;
    };
    const accounts = await listMetaAdsAccounts(
      input.accessToken,
      input.fetchImpl,
      undefined,
      collectTelemetry
    );
    const account = accounts.find(
      (candidate) =>
        candidate.accountId === input.connection.provider_customer_id
    );
    if (!account) throw new MetaAdsSyncError('META_ADS_ACCOUNT_NOT_ACCESSIBLE');
    const insights = await fetchMetaAdsDailyInsights(
      {
        accessToken: input.accessToken,
        accountId: account.accountId,
        endDate: input.endDate,
        startDate: input.startDate,
      },
      input.fetchImpl,
      undefined,
      collectTelemetry
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
        usageTelemetry,
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
  } catch (error) {
    if (shouldRequireReauth(error)) {
      try {
        await markMetaAdsReauthRequired({
          connection: input.connection,
          failureCode: reauthFailureCode(error),
          merchantId: input.merchantId,
          supabase: input.supabase,
        });
      } catch {
        throw new MetaAdsSyncError('META_ADS_REAUTH_PERSIST_FAILED');
      }
    }
    if (error instanceof MetaAdsSyncError) throw error;
    throw error;
  }
}
