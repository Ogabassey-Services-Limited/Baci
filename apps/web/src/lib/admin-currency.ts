import { type CurrencyConfig, formatCurrencyWithConfig } from '@/lib/currency';

export const ADMIN_CURRENCY_CONFIG = {
  code: 'NGN',
  locale: 'en-NG',
  symbol: '₦',
} as const satisfies CurrencyConfig;

/**
 * Switches whole-naira admin metrics to compact notation from ₦1K upward.
 */
export const ADMIN_COMPACT_CURRENCY_THRESHOLD = 1000;

function parseCurrencyValue(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue =
    typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function formatAdminCurrency(
  value: number | string | null | undefined,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  return formatCurrencyWithConfig(
    parseCurrencyValue(value),
    ADMIN_CURRENCY_CONFIG,
    options
  );
}

export function formatAdminCompactCurrency(
  value: number | string | null | undefined,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  return formatAdminCurrency(value, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    notation: 'compact',
    ...options,
  });
}

export function formatAdminThresholdCurrency(
  value: number | string | null | undefined
): string {
  const numericValue = parseCurrencyValue(value);

  return numericValue >= ADMIN_COMPACT_CURRENCY_THRESHOLD
    ? formatAdminCompactCurrency(numericValue)
    : formatAdminCurrency(numericValue);
}
