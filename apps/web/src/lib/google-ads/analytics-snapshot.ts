export interface GoogleAdsAnalyticsConnection {
  last_synced_at: string | null;
  provider_customer_id: string | null;
  status: string;
}

export interface GoogleAdsAnalyticsSpendRow {
  clicks: number | string | null;
  conversions: number | string | null;
  currency_code: string;
  fetched_at: string;
  impressions: number | string | null;
  provider_customer_id: string;
  spend_date: string;
  spend_micros: number | string;
}

function nonNegativeNumber(value: number | string | null): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function nonNegativeMicros(value: number | string): string {
  const parsed = String(value);
  return /^\d+$/.test(parsed) ? parsed : '0';
}

export interface GoogleAdsAnalyticsSnapshot {
  connected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  currencyCode?: string;
  customerId: string | null;
  dataStatus: 'error' | 'ready';
  daily?: Array<{
    clicks: number;
    conversions: number;
    currencyCode: string;
    date: string;
    fetchedAt: string;
    impressions: number;
    spend: number;
    spendMicros: string;
  }>;
  lastSyncedAt: string | null;
  needsAccountSelection: boolean;
  error?: string;
  isStale: boolean;
  spend?: number;
  spendMicros?: string;
}

interface BuildGoogleAdsAnalyticsSnapshotOptions {
  connectionReadFailed?: boolean;
  now?: Date;
  spendReadFailed?: boolean;
}

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

function latestTimestamp(values: Array<string | null>): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (Number.isFinite(time) && time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }
  return latest;
}

export function buildGoogleAdsAnalyticsSnapshot(
  connection: GoogleAdsAnalyticsConnection | null,
  rows: GoogleAdsAnalyticsSpendRow[],
  {
    connectionReadFailed = false,
    now = new Date(),
    spendReadFailed = false,
  }: BuildGoogleAdsAnalyticsSnapshotOptions = {}
): GoogleAdsAnalyticsSnapshot | undefined {
  if (connectionReadFailed) {
    return {
      connected: false,
      connectionStatus: 'error',
      customerId: null,
      dataStatus: 'error',
      error: 'Google Ads reporting is temporarily unavailable.',
      isStale: false,
      lastSyncedAt: null,
      needsAccountSelection: false,
    };
  }

  if (!connection) return undefined;
  const connected = connection.status === 'active';
  const connectionStatus =
    connection.status === 'error'
      ? 'error'
      : connected
        ? 'connected'
        : 'disconnected';
  const selectedCustomerId = connected ? connection.provider_customer_id : null;
  const selectedRows = selectedCustomerId
    ? rows.filter((row) => row.provider_customer_id === selectedCustomerId)
    : [];
  const daily = selectedRows.map((row) => {
    const spendMicros = nonNegativeMicros(row.spend_micros);
    return {
      clicks: nonNegativeNumber(row.clicks),
      conversions: nonNegativeNumber(row.conversions),
      currencyCode: row.currency_code,
      date: row.spend_date,
      fetchedAt: row.fetched_at,
      impressions: nonNegativeNumber(row.impressions),
      spend: Number(spendMicros) / 1_000_000,
      spendMicros,
    };
  });
  const lastSyncedAt = latestTimestamp([
    connection.last_synced_at,
    ...daily.map((row) => row.fetchedAt),
  ]);
  const isStale =
    connected &&
    lastSyncedAt !== null &&
    now.getTime() - Date.parse(lastSyncedAt) > STALE_AFTER_MS;
  const dataStatus = spendReadFailed ? 'error' : 'ready';
  const error =
    dataStatus === 'error'
      ? 'Google Ads reporting is temporarily unavailable.'
      : connectionStatus === 'error'
        ? 'This connection needs to be reauthorized.'
        : undefined;
  if (daily.length === 0) {
    return {
      connected,
      connectionStatus,
      customerId: connection.provider_customer_id,
      dataStatus,
      error,
      isStale,
      lastSyncedAt,
      needsAccountSelection: connected && !connection.provider_customer_id,
    };
  }

  let spendMicros = 0n;
  for (const row of daily) spendMicros += BigInt(row.spendMicros);
  return {
    connected,
    connectionStatus,
    currencyCode: daily[0]?.currencyCode,
    customerId: connection.provider_customer_id,
    dataStatus,
    daily,
    error,
    isStale,
    lastSyncedAt,
    needsAccountSelection: connected && !connection.provider_customer_id,
    spend: Number(spendMicros) / 1_000_000,
    spendMicros: spendMicros.toString(),
  };
}
