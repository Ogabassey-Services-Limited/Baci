import {
  formatAdminCompactCurrency,
  formatAdminCurrency,
} from '@/lib/admin-currency';

export function formatAnalyticsCurrency(value: number): string {
  return value >= 1000
    ? formatAdminCompactCurrency(value)
    : formatAdminCurrency(value);
}

export function formatAnalyticsNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

export function formatAnalyticsPercentage(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}
