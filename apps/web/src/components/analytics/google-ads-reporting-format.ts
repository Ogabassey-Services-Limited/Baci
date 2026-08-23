function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      currency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
      style: 'currency',
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatGoogleAdsMetric(
  value: number,
  kind: 'currency' | 'number' | 'percent',
  currency: string
): string {
  if (kind === 'currency') return formatCurrency(value, currency);
  if (kind === 'percent') return `${value.toFixed(2)}%`;
  return formatNumber(value);
}

export function formatGoogleAdsReportingWindow(metrics: {
  endDate?: string;
  startDate?: string;
}): string | null {
  if (!metrics.startDate || !metrics.endDate) return null;
  return `${metrics.startDate} – ${metrics.endDate}`;
}
