'use client';

/**
 * React hook for currency formatting in storefront components
 *
 * Automatically uses the merchant's country for currency formatting,
 * providing a consistent currency display across all storefront pages.
 */

import {
  COMPACT_OPTIONS,
  type CurrencyConfig,
  formatCurrencyWithConfig as formatCurrencyWithConfigUtil,
  getCurrencyCode as getCurrencyCodeUtil,
  getCurrencyConfig,
  getCurrencySymbol as getCurrencySymbolUtil,
} from '@/lib/currency';
import { useMerchantSafe } from './use-merchant-client';

export interface UseCurrencyReturn {
  /** Format amount as currency (e.g., "₦1,000.00") */
  formatCurrency: (amount: number) => string;
  /** Format amount without decimals (e.g., "₦1,000") */
  formatCurrencyCompact: (amount: number) => string;
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
  const countryCode = merchantContext?.merchant?.country ?? null;

  const config = getCurrencyConfig(countryCode);

  const formatCurrency = (amount: number) =>
    formatCurrencyWithConfigUtil(amount, config);

  const formatCurrencyCompact = (amount: number) =>
    formatCurrencyWithConfigUtil(amount, config, COMPACT_OPTIONS);

  const currencySymbol = getCurrencySymbolUtil(countryCode);

  const currencyCode = getCurrencyCodeUtil(countryCode);

  return {
    formatCurrency,
    formatCurrencyCompact,
    currencySymbol,
    currencyCode,
    config,
    countryCode,
  };
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
  countryCode: string | null | undefined
): UseCurrencyReturn {
  const config = getCurrencyConfig(countryCode);

  const formatCurrency = (amount: number) =>
    formatCurrencyWithConfigUtil(amount, config);

  const formatCurrencyCompact = (amount: number) =>
    formatCurrencyWithConfigUtil(amount, config, COMPACT_OPTIONS);

  const currencySymbol = getCurrencySymbolUtil(countryCode);

  const currencyCodeValue = getCurrencyCodeUtil(countryCode);

  return {
    formatCurrency,
    formatCurrencyCompact,
    currencySymbol,
    currencyCode: currencyCodeValue,
    config,
    countryCode: countryCode ?? null,
  };
}
