'use client';

/**
 * React hook for currency formatting in storefront components
 *
 * Automatically uses the merchant's country for currency formatting,
 * providing a consistent currency display across all storefront pages.
 */

import {
  AUTO_FRACTION_OPTIONS,
  COMPACT_OPTIONS,
  type CurrencyConfig,
  formatCurrencyWithConfig as formatCurrencyWithConfigUtil,
} from '@/lib/currency';
import {
  type MerchantCurrencySource,
  resolveMerchantCurrencyConfig,
} from '@/lib/resolve-merchant-currency';
import { useMerchantSafe } from './use-merchant-client';

export interface UseCurrencyReturn {
  /** Format amount as currency (e.g., "₦1,000.00") */
  formatCurrency: (amount: number) => string;
  /** Format amount without decimals (e.g., "₦1,000") */
  formatCurrencyCompact: (amount: number) => string;
  /**
   * Format exact charge amounts: whole numbers without decimals ("₦1,000"),
   * fractional amounts with cents kept ("₦1,000.50") instead of rounded away.
   * Use for customer-facing totals and pay buttons.
   */
  formatCurrencyAuto: (amount: number) => string;
  /** Get just the currency symbol (e.g., "₦") */
  currencySymbol: string;
  /** Get the currency code (e.g., "NGN") */
  currencyCode: string;
  /** Full currency configuration */
  config: CurrencyConfig;
  /** The country code being used */
  countryCode: string | null;
}

/**
 * Build the hook return value from a merchant currency source using the
 * canonical resolver (`resolveMerchantCurrencyConfig`): payout_currency first,
 * country second, NGN platform fallback. Kept at module scope (not a hook) so
 * the React Compiler can lower callers cleanly.
 */
function buildCurrencyReturn(
  source: MerchantCurrencySource,
  countryCode: string | null
): UseCurrencyReturn {
  const config = resolveMerchantCurrencyConfig(source);

  return {
    formatCurrency: (amount: number) =>
      formatCurrencyWithConfigUtil(amount, config),
    formatCurrencyCompact: (amount: number) =>
      formatCurrencyWithConfigUtil(amount, config, COMPACT_OPTIONS),
    formatCurrencyAuto: (amount: number) =>
      formatCurrencyWithConfigUtil(amount, config, AUTO_FRACTION_OPTIONS),
    currencySymbol: config.symbol,
    currencyCode: config.code,
    config,
    countryCode,
  };
}

/**
 * Hook for currency formatting using merchant's country
 *
 * @example
 * function ProductPrice({ price }: { price: number }) {
 *   const { formatCurrency } = useCurrency();
 *   return <span>{formatCurrency(price)}</span>;
 * }
 *
 * @example
 * function PriceDisplay({ price }: { price: number }) {
 *   const { currencySymbol, formatCurrencyCompact } = useCurrency();
 *   return (
 *     <div>
 *       <span className="text-sm">{currencySymbol}</span>
 *       <span className="text-2xl">{formatCurrencyCompact(price)}</span>
 *     </div>
 *   );
 * }
 */
export function useCurrency(): UseCurrencyReturn {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const countryCode = merchant?.country ?? null;

  return buildCurrencyReturn(
    {
      country: countryCode,
      payout_currency: merchant?.payout_currency ?? null,
    },
    countryCode
  );
}

/**
 * Hook for currency formatting with explicit country code
 * Use this when you have the country code directly (e.g., from props)
 *
 * @example
 * function OrderTotal({ total, merchantCountry }: Props) {
 *   const { formatCurrency } = useCurrencyWithCountry(merchantCountry);
 *   return <span>{formatCurrency(total)}</span>;
 * }
 */
export function useCurrencyWithCountry(
  countryCode: string | null | undefined,
  payoutCurrency?: string | null
): UseCurrencyReturn {
  return buildCurrencyReturn(
    { country: countryCode ?? null, payout_currency: payoutCurrency ?? null },
    countryCode ?? null
  );
}
