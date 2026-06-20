import { useMerchant } from '@/hooks/useMerchant';
import {
  formatCurrency,
  formatCurrencyCompactNotation,
  getCurrencySymbol,
} from '@/lib/utils';

const DEFAULT_CURRENCY = 'NGN';
const NIGERIAN_NAIRA_SYMBOL = '₦';

export interface CurrencyFormatter {
  /** ISO-4217 currency code resolved from merchant settings. */
  currency: string;
  /** Localized currency symbol (e.g. ₦, $, £). */
  symbol: string;
  /** Full currency formatting with two decimals. */
  format: (
    amount: number,
    options?: Partial<Intl.NumberFormatOptions>
  ) => string;
  /** Compact currency formatting (e.g. ₦1.2M). */
  formatCompact: (amount: number) => string;
}

/**
 * Returns currency formatters bound to the current merchant's payout currency.
 * Locale defaults to the device/runtime locale so the formatter adapts as we
 * expand beyond the Nigerian pilot market.
 */
export function useCurrency(): CurrencyFormatter {
  const { merchant } = useMerchant();
  const currency = (
    merchant?.payout_currency?.trim() || DEFAULT_CURRENCY
  ).toUpperCase();
  const symbol =
    currency === DEFAULT_CURRENCY
      ? NIGERIAN_NAIRA_SYMBOL
      : getCurrencySymbol(currency);

  return {
    currency,
    symbol,
    format: (amount: number, options?: Partial<Intl.NumberFormatOptions>) =>
      formatCurrency(amount, options, currency),
    formatCompact: (amount: number) =>
      formatCurrencyCompactNotation(amount, currency),
  };
}
