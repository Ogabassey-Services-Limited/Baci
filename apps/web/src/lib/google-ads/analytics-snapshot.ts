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
  currencyCode?: string;
  customerId: string | null;
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
  spend?: number;
  spendMicros?: string;
}

export function buildGoogleAdsAnalyticsSnapshot(
  connection: GoogleAdsAnalyticsConnection | null,
  rows: GoogleAdsAnalyticsSpendRow[]
): GoogleAdsAnalyticsSnapshot | undefined {
  if (!connection) return undefined;
  const selectedCustomerId =
    connection.status === 'active' ? connection.provider_customer_id : null;
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
  if (daily.length === 0) {
    return {
      connected: connection.status === 'active',
      customerId: connection.provider_customer_id,
      lastSyncedAt: connection.last_synced_at,
      needsAccountSelection:
        connection.status === 'active' && !connection.provider_customer_id,
    };
  }

  let spendMicros = 0n;
  for (const row of daily) spendMicros += BigInt(row.spendMicros);
  return {
    connected: connection.status === 'active',
    currencyCode: daily[0]?.currencyCode,
    customerId: connection.provider_customer_id,
    daily,
    lastSyncedAt: connection.last_synced_at,
    needsAccountSelection:
      connection.status === 'active' && !connection.provider_customer_id,
    spend: Number(spendMicros) / 1_000_000,
    spendMicros: spendMicros.toString(),
  };
}
