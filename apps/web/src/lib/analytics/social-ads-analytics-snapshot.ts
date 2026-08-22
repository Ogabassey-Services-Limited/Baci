export const SOCIAL_ADS_REPORTING_PROVIDERS = [
  'meta_ads',
  'tiktok_ads',
  'snapchat_ads',
] as const;

export type SocialAdsReportingProvider =
  (typeof SOCIAL_ADS_REPORTING_PROVIDERS)[number];

interface SocialAdsConnectionRow {
  account_timezone: string | null;
  last_synced_at: string | null;
  provider: string;
  provider_account_label: string | null;
  provider_customer_id: string | null;
  status: string;
}

interface SocialAdsSpendRow {
  account_timezone: string | null;
  clicks: number | string | null;
  conversions: number | string | null;
  currency_code: string;
  fetched_at: string;
  impressions: number | string | null;
  provider: string;
  provider_customer_id: string;
  reach: number | string | null;
  spend_amount_decimal: number | string | null;
  spend_date: string;
}

interface BuildSocialAdsAnalyticsSnapshotOptions {
  connectionReadFailed?: boolean;
  connections: SocialAdsConnectionRow[];
  endDate: string;
  now?: Date;
  spendReadFailed?: boolean;
  spendRows: SocialAdsSpendRow[];
  startDate: string;
}

const PROVIDER_DETAILS = {
  meta_ads: {
    clicksLabel: 'Clicks',
    conversionsLabel: 'Meta-attributed conversions',
    displayName: 'Meta Ads',
  },
  snapchat_ads: {
    clicksLabel: 'Swipe Ups',
    conversionsLabel: 'Snapchat-attributed purchases',
    displayName: 'Snapchat Ads',
  },
  tiktok_ads: {
    clicksLabel: 'Clicks',
    conversionsLabel: 'TikTok-attributed conversions',
    displayName: 'TikTok Ads',
  },
} as const;

const NON_NEGATIVE_DECIMAL = /^\d+(?:\.\d+)?$/;
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

function decimalString(value: number | string | null): string {
  const normalized = String(value ?? '0');
  return NON_NEGATIVE_DECIMAL.test(normalized) ? normalized : '0';
}

function addDecimals(left: string, right: string): string {
  const [leftWhole = '0', leftFraction = ''] = left.split('.');
  const [rightWhole = '0', rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftInteger = BigInt(`${leftWhole}${leftFraction.padEnd(scale, '0')}`);
  const rightInteger = BigInt(
    `${rightWhole}${rightFraction.padEnd(scale, '0')}`
  );
  const total = (leftInteger + rightInteger)
    .toString()
    .padStart(scale + 1, '0');
  if (scale === 0) return total;
  const whole = total.slice(0, -scale);
  const fraction = total.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function sumField(
  rows: SocialAdsSpendRow[],
  field: 'clicks' | 'conversions' | 'impressions' | 'reach'
): string {
  return rows.reduce(
    (total, row) => addDecimals(total, decimalString(row[field])),
    '0'
  );
}

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

function spendByCurrency(rows: SocialAdsSpendRow[]) {
  const totals = new Map<string, string>();
  for (const row of rows) {
    const currencyCode = row.currency_code.toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) continue;
    totals.set(
      currencyCode,
      addDecimals(
        totals.get(currencyCode) ?? '0',
        decimalString(row.spend_amount_decimal)
      )
    );
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currencyCode, spendAmountDecimal]) => ({
      currencyCode,
      spendAmountDecimal,
    }));
}

/**
 * Builds a credential-free reporting projection. Provider conversions remain
 * explicitly provider-attributed and are never combined with Baci order
 * revenue or used to manufacture cross-currency ROAS.
 */
export function buildSocialAdsAnalyticsSnapshot({
  connectionReadFailed = false,
  connections,
  endDate,
  now = new Date(),
  spendReadFailed = false,
  spendRows,
  startDate,
}: BuildSocialAdsAnalyticsSnapshotOptions) {
  const selectedSpendRows = spendRows.filter((row) => {
    const connection = connections.find(
      (candidate) => candidate.provider === row.provider
    );
    return (
      connection?.status === 'active' &&
      Boolean(connection.provider_customer_id) &&
      row.provider_customer_id === connection.provider_customer_id
    );
  });
  const providers = SOCIAL_ADS_REPORTING_PROVIDERS.map((provider) => {
    const connection = connections.find((row) => row.provider === provider);
    const rows = selectedSpendRows.filter((row) => row.provider === provider);
    const lastSyncedAt = latestTimestamp([
      connection?.last_synced_at ?? null,
      ...rows.map((row) => row.fetched_at),
    ]);
    const isConnected = connection?.status === 'active';
    const needsAccountSelection =
      isConnected && !connection?.provider_customer_id;
    const freshness = !isConnected
      ? 'not_applicable'
      : !lastSyncedAt
        ? 'never_synced'
        : now.getTime() - Date.parse(lastSyncedAt) > STALE_AFTER_MS
          ? 'stale'
          : 'fresh';
    const dataStatus =
      connectionReadFailed || spendReadFailed ? 'error' : 'ready';
    const connectionStatus = connectionReadFailed
      ? 'error'
      : connection?.status === 'error'
        ? 'error'
        : isConnected
          ? 'connected'
          : 'disconnected';

    return {
      accountName: connection?.provider_account_label ?? null,
      accountTimezone:
        connection?.account_timezone ?? rows[0]?.account_timezone ?? null,
      clicksLabel: PROVIDER_DETAILS[provider].clicksLabel,
      connectionStatus,
      conversionsLabel: PROVIDER_DETAILS[provider].conversionsLabel,
      dataStatus,
      displayName: PROVIDER_DETAILS[provider].displayName,
      error:
        dataStatus === 'error'
          ? 'Reporting data is temporarily unavailable.'
          : connectionStatus === 'error'
            ? 'This connection needs to be reauthorized.'
            : null,
      freshness,
      isStale: freshness === 'stale',
      lastSyncedAt,
      metrics:
        rows.length === 0
          ? null
          : {
              clicks: sumField(rows, 'clicks'),
              conversions: sumField(rows, 'conversions'),
              endDate,
              impressions: sumField(rows, 'impressions'),
              reach: rows.some((row) => row.reach !== null)
                ? sumField(rows, 'reach')
                : null,
              spendByCurrency: spendByCurrency(rows),
              startDate,
            },
      needsAccountSelection,
      provider,
    };
  });
  const allSpend = spendByCurrency(selectedSpendRows);

  return {
    attributionNotice:
      'Provider-attributed conversions are reporting signals and are separate from Baci paid orders and revenue.',
    mixedCurrencies: allSpend.length > 1,
    providers,
    spendByCurrency: allSpend,
  };
}
