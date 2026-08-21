import type {
  GoogleAdsConnectionStatus,
  GoogleAdsReportingData,
  GoogleAdsReportingMetrics,
} from '@/components/analytics/google-ads-reporting-card';

interface JsonRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asGoogleAdsConnectionStatus(
  value: unknown
): GoogleAdsConnectionStatus | undefined {
  if (
    value === 'connected' ||
    value === 'disconnected' ||
    value === 'error' ||
    value === 'syncing'
  ) {
    return value;
  }

  return undefined;
}

function mapGoogleAdsMetricNumber(
  metrics: JsonRecord,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = asOptionalNumber(metrics[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function sumGoogleAdsRows(rows: JsonRecord[], key: string): number | undefined {
  let total = 0;
  let hasValue = false;

  for (const row of rows) {
    const value = asOptionalNumber(row[key]);
    if (value === undefined) continue;
    total += value;
    hasValue = true;
  }

  return hasValue ? total : undefined;
}

export function mapGoogleAdsReporting(
  value: unknown
): GoogleAdsReportingData | undefined {
  const googleAds = asRecord(value);
  if (!googleAds) return undefined;

  const connection = asRecord(googleAds.connection);
  const metricsRecord = asRecord(googleAds.metrics) ?? googleAds;
  const rows = asArray(googleAds.rows ?? googleAds.daily);
  const metrics: GoogleAdsReportingMetrics = {
    clicks:
      mapGoogleAdsMetricNumber(metricsRecord, 'clicks') ??
      sumGoogleAdsRows(rows, 'clicks'),
    conversions:
      mapGoogleAdsMetricNumber(
        metricsRecord,
        'conversions',
        'totalConversions'
      ) ?? sumGoogleAdsRows(rows, 'conversions'),
    cpc: mapGoogleAdsMetricNumber(metricsRecord, 'cpc'),
    ctr: mapGoogleAdsMetricNumber(metricsRecord, 'ctr'),
    endDate: asOptionalString(metricsRecord.endDate ?? googleAds.endDate),
    impressions:
      mapGoogleAdsMetricNumber(metricsRecord, 'impressions') ??
      sumGoogleAdsRows(rows, 'impressions'),
    roas: mapGoogleAdsMetricNumber(metricsRecord, 'roas'),
    spend:
      mapGoogleAdsMetricNumber(metricsRecord, 'spend', 'totalSpend') ??
      sumGoogleAdsRows(rows, 'spend'),
    startDate: asOptionalString(metricsRecord.startDate ?? googleAds.startDate),
  };

  const roasBasis = asOptionalString(metricsRecord.roasBasis);
  if (roasBasis === 'baci-attributed-revenue') {
    metrics.roasBasis = roasBasis;
  }

  const hasMetrics = Object.values(metrics).some(
    (metric) => metric !== undefined
  );
  const status =
    asGoogleAdsConnectionStatus(
      connection?.status ?? googleAds.connectionStatus ?? googleAds.status
    ) ??
    (connection?.connected === true || googleAds.connected === true
      ? 'connected'
      : connection?.connected === false || googleAds.connected === false
        ? 'disconnected'
        : hasMetrics
          ? 'connected'
          : undefined);

  return {
    accountName: asOptionalString(
      connection?.accountName ?? googleAds.accountName ?? googleAds.name
    ),
    connectionStatus: status,
    currency: asOptionalString(
      connection?.currency ?? googleAds.currency ?? googleAds.currencyCode
    ),
    error: asOptionalString(connection?.error ?? googleAds.error),
    lastSyncedAt: asOptionalString(
      googleAds.lastSyncedAt ?? googleAds.last_synced_at
    ),
    metrics: hasMetrics ? metrics : undefined,
    needsAccountSelection:
      googleAds.needsAccountSelection === true ||
      googleAds.requiresAccountSelection === true ||
      (googleAds.connected === true && googleAds.customerId === null),
  };
}
